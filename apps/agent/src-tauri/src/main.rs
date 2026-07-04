#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use directories::ProjectDirs;
use parking_lot::Mutex;
use reqwest::blocking::Client;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use system_idle_time::get_idle_time;
use tauri::State;
use uuid::Uuid;
use windows_sys::Win32::Foundation::{CloseHandle, HWND};
use windows_sys::Win32::System::Threading::{
    OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
};

const DEFAULT_API_URL: &str = "http://localhost:4000";
const SAMPLE_INTERVAL: Duration = Duration::from_secs(2);
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);
const IDLE_THRESHOLD_SECONDS: u64 = 60;
const MAX_SLICE_SECONDS: i64 = 300;

#[derive(Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum ActivityState {
    Active,
    Idle,
    Paused,
    Stopped,
}

impl ActivityState {
    fn is_running(self) -> bool {
        matches!(self, Self::Active | Self::Idle)
    }
}

#[derive(Clone, Serialize, Deserialize)]
struct ActivityEventPayload {
    #[serde(rename = "deviceId")]
    device_id: String,
    #[serde(rename = "deviceName")]
    device_name: String,
    platform: String,
    #[serde(rename = "appName")]
    app_name: String,
    #[serde(rename = "windowTitle")]
    window_title: String,
    state: ActivityState,
    #[serde(rename = "startedAt")]
    started_at: String,
    #[serde(rename = "endedAt")]
    ended_at: String,
    #[serde(rename = "durationSeconds")]
    duration_seconds: i64,
    #[serde(rename = "capturedAt")]
    captured_at: String,
    source: String,
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
    url: Option<String>,
    domain: Option<String>,
    classification: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct HeartbeatPayload {
    #[serde(rename = "deviceId")]
    device_id: String,
    #[serde(rename = "deviceName")]
    device_name: String,
    platform: String,
    status: ActivityState,
    #[serde(rename = "capturedAt")]
    captured_at: String,
    #[serde(rename = "lastAppName")]
    last_app_name: Option<String>,
    #[serde(rename = "lastWindowTitle")]
    last_window_title: Option<String>,
    source: Option<String>,
    #[serde(rename = "lastUrl")]
    last_url: Option<String>,
    #[serde(rename = "lastDomain")]
    last_domain: Option<String>,
    #[serde(rename = "lastClassification")]
    last_classification: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct AgentSettings {
    #[serde(rename = "apiUrl")]
    api_url: String,
    #[serde(rename = "apiToken")]
    api_token: String,
    #[serde(rename = "excludedApps")]
    excluded_apps: Vec<String>,
    #[serde(rename = "deviceId")]
    device_id: String,
}

impl Default for AgentSettings {
    fn default() -> Self {
        Self {
            api_url: DEFAULT_API_URL.to_owned(),
            api_token: String::new(),
            excluded_apps: Vec::new(),
            device_id: Uuid::new_v4().to_string(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum QueueItem {
    Activity { payload: ActivityEventPayload },
    Heartbeat { payload: HeartbeatPayload },
}

#[derive(Serialize)]
struct AgentSyncPayload {
    events: Vec<ActivityEventPayload>,
    heartbeats: Vec<HeartbeatPayload>,
}

struct PendingRecord {
    id: i64,
    item: QueueItem,
}

#[derive(Clone, Serialize)]
struct AgentStatus {
    device_id: String,
    device_name: String,
    api_url: String,
    api_token: String,
    excluded_apps: Vec<String>,
    last_sync_at: Option<String>,
    last_window_title: String,
    last_app_name: String,
    state: ActivityState,
    tracked_seconds_total: i64,
    current_run_started_at: Option<String>,
    pending_queue_count: usize,
    sync_state: String,
    message: String,
}

impl AgentStatus {
    fn from_settings(settings: &AgentSettings) -> Self {
        Self {
            device_id: settings.device_id.clone(),
            device_name: computer_name(),
            api_url: settings.api_url.clone(),
            api_token: settings.api_token.clone(),
            excluded_apps: settings.excluded_apps.clone(),
            last_sync_at: None,
            last_window_title: String::new(),
            last_app_name: String::new(),
            state: ActivityState::Stopped,
            tracked_seconds_total: 0,
            current_run_started_at: None,
            pending_queue_count: 0,
            sync_state: "idle".to_owned(),
            message: "Ready to start tracking.".to_owned(),
        }
    }
}

#[derive(Clone)]
struct UiState {
    status: AgentStatus,
}

enum AgentCommand {
    Start,
    Pause,
    Stop,
    SaveSettings { api_url: String, api_token: String, excluded_apps: Vec<String> },
}

struct RuntimeFiles {
    settings_path: PathBuf,
    sqlite_path: PathBuf,
}

#[derive(Clone, PartialEq, Eq)]
struct WindowSnapshot {
    app_name: String,
    window_title: String,
}

struct WorkerRuntime {
    client: Client,
    sqlite: Connection,
    settings: AgentSettings,
    status: AgentStatus,
    current_slice_started_at: Option<DateTime<Utc>>,
    current_slice_snapshot: Option<WindowSnapshot>,
    current_slice_state: Option<ActivityState>,
    current_session_id: Option<String>,
    files: RuntimeFiles,
}

impl WorkerRuntime {
    fn new(files: RuntimeFiles) -> Self {
        let settings = load_settings(&files.settings_path);
        let sqlite = open_sqlite(&files.sqlite_path);
        let mut status = AgentStatus::from_settings(&settings);
            status.pending_queue_count = count_pending_items(&sqlite);
        if status.pending_queue_count > 0 {
            status.sync_state = "queued".to_owned();
        }
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .expect("failed to build HTTP client"),
            sqlite,
            settings,
            status,
            current_slice_started_at: None,
            current_slice_snapshot: None,
            current_slice_state: None,
            current_session_id: None,
            files,
        }
    }

    fn persist_settings(&self) {
        if let Ok(json) = serde_json::to_string_pretty(&self.settings) {
            let _ = fs::write(&self.files.settings_path, json);
        }
    }

    fn push_status(&self, shared: &Arc<Mutex<UiState>>) {
        shared.lock().status = self.status.clone();
    }

    fn normalize_excluded_apps(values: &[String]) -> Vec<String> {
        values
            .iter()
            .map(|value| value.trim().to_ascii_lowercase())
            .filter(|value| !value.is_empty())
            .collect()
    }

    fn save_settings_command(&mut self, api_url: String, api_token: String, excluded_apps: Vec<String>) {
        self.settings.api_url = if api_url.trim().is_empty() {
            DEFAULT_API_URL.to_owned()
        } else {
            api_url.trim().to_owned()
        };
        self.settings.api_token = api_token.trim().to_owned();
        self.settings.excluded_apps = Self::normalize_excluded_apps(&excluded_apps);
        self.status.api_url = self.settings.api_url.clone();
        self.status.api_token = self.settings.api_token.clone();
        self.status.excluded_apps = self.settings.excluded_apps.clone();
        self.status.message = "Settings saved.".to_owned();
        self.persist_settings();
    }

    fn handle_command(&mut self, command: AgentCommand) {
        match command {
            AgentCommand::Start => {
                if self.status.state != ActivityState::Paused {
                    self.status.tracked_seconds_total = 0;
                }
                self.status.state = ActivityState::Active;
                let now = Utc::now();
                self.begin_new_slice(now, self.capture_snapshot(), ActivityState::Active, true);
                self.status.message = "Tracking started.".to_owned();
                self.send_heartbeat();
            }
            AgentCommand::Pause => {
                if self.status.state.is_running() {
                    self.capture_and_send_slice(true);
                    self.status.state = ActivityState::Paused;
                    self.reset_current_slice();
                    self.status.message = "Tracking paused.".to_owned();
                    self.send_heartbeat();
                }
            }
            AgentCommand::Stop => {
                if self.status.state.is_running() {
                    self.capture_and_send_slice(true);
                }
                self.status.state = ActivityState::Stopped;
                self.status.tracked_seconds_total = 0;
                self.reset_current_slice();
                self.status.message = "Tracking stopped.".to_owned();
                self.send_heartbeat();
            }
            AgentCommand::SaveSettings { api_url, api_token, excluded_apps } => {
                self.save_settings_command(api_url, api_token, excluded_apps)
            }
        }
    }

    fn is_excluded_app(&self, app_name: &str) -> bool {
        let normalized = app_name.trim().to_ascii_lowercase();
        self.settings.excluded_apps.iter().any(|item| item == &normalized)
    }

    fn capture_snapshot(&self) -> WindowSnapshot {
        let snapshot = foreground_window_snapshot();
        if self.is_excluded_app(&snapshot.app_name) {
            WindowSnapshot {
                app_name: "Excluded application".to_owned(),
                window_title: "Hidden by privacy settings".to_owned(),
            }
        } else {
            snapshot
        }
    }

    fn reset_current_slice(&mut self) {
        self.current_slice_started_at = None;
        self.current_slice_snapshot = None;
        self.current_slice_state = None;
        self.current_session_id = None;
        self.status.current_run_started_at = None;
    }

    fn begin_new_slice(
        &mut self,
        now: DateTime<Utc>,
        snapshot: WindowSnapshot,
        state: ActivityState,
        renew_session: bool,
    ) {
        if renew_session || self.current_session_id.is_none() {
            self.current_session_id = Some(Uuid::new_v4().to_string());
        }
        self.current_slice_started_at = Some(now);
        self.current_slice_snapshot = Some(snapshot.clone());
        self.current_slice_state = Some(state);
        self.status.current_run_started_at = Some(now.to_rfc3339());
        self.status.state = state;
        self.status.last_app_name = snapshot.app_name;
        self.status.last_window_title = snapshot.window_title;
    }

    fn observed_state(&self) -> ActivityState {
        let idle_seconds = get_idle_time().map(|duration| duration.as_secs()).unwrap_or_default();
        if idle_seconds >= IDLE_THRESHOLD_SECONDS {
            ActivityState::Idle
        } else {
            ActivityState::Active
        }
    }

    fn record_sync_success(&mut self) {
        self.status.last_sync_at = Some(Utc::now().to_rfc3339());
        self.status.pending_queue_count = count_pending_items(&self.sqlite);
        self.status.sync_state = if self.status.pending_queue_count == 0 {
            "idle".to_owned()
        } else {
            "queued".to_owned()
        };
    }

    fn enqueue(&mut self, item: QueueItem) {
        insert_pending_item(&self.sqlite, &item);
        self.status.sync_state = "queued".to_owned();
        self.status.pending_queue_count = count_pending_items(&self.sqlite);
        self.status.message =
            "Backend unavailable. Events stored in local SQLite and will sync automatically."
                .to_owned();
    }

    fn send_json<T: Serialize>(&mut self, path: &str, body: &T) -> Result<(), String> {
        let url = format!("{}{}", self.settings.api_url, path);
        let mut request = self.client.post(url).json(body);
        if !self.settings.api_token.trim().is_empty() {
            request = request.bearer_auth(self.settings.api_token.trim());
        }
        let response = request.send().map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Err(format!("request failed with status {}", response.status()));
        }
        self.record_sync_success();
        Ok(())
    }

    fn send_or_queue(&mut self, item: QueueItem) {
        let send_result = match &item {
            QueueItem::Activity { payload } => self.send_json("/api/activity", payload),
            QueueItem::Heartbeat { payload } => self.send_json("/api/heartbeat", payload),
        };

        if send_result.is_err() {
            self.enqueue(item);
        } else if count_pending_items(&self.sqlite) > 0 {
            self.flush_queue();
        }
    }

    fn flush_queue(&mut self) {
        let pending_records = load_pending_items(&self.sqlite, 500);
        if pending_records.is_empty() {
            self.status.sync_state = "idle".to_owned();
            self.status.pending_queue_count = 0;
            return;
        }

        self.status.sync_state = "syncing".to_owned();
        let mut events = Vec::new();
        let mut heartbeats = Vec::new();
        let mut ids = Vec::new();

        for record in &pending_records {
            ids.push(record.id);
            match &record.item {
                QueueItem::Activity { payload } => events.push(payload.clone()),
                QueueItem::Heartbeat { payload } => heartbeats.push(payload.clone()),
            }
        }

        let failed = self
            .send_json("/api/agent/sync", &AgentSyncPayload { events, heartbeats })
            .is_err();

        if failed {
            self.status.sync_state = "error".to_owned();
            self.status.pending_queue_count = count_pending_items(&self.sqlite);
            self.status.message = "SQLite sync failed. Will retry automatically.".to_owned();
        } else {
            delete_pending_items(&mut self.sqlite, &ids);
            self.status.pending_queue_count = count_pending_items(&self.sqlite);
            self.status.sync_state = "idle".to_owned();
            self.status.message = "Stored SQLite events synced successfully.".to_owned();
        }
    }

    fn capture_and_send_slice(&mut self, force_flush: bool) {
        if !self.status.state.is_running() {
            return;
        }

        let now = Utc::now();
        let snapshot = self.capture_snapshot();
        let observed_state = self.observed_state();

        let Some(started_at) = self.current_slice_started_at else {
            self.begin_new_slice(now, snapshot, observed_state, true);
            return;
        };

        let previous_snapshot = self
            .current_slice_snapshot
            .clone()
            .unwrap_or_else(|| snapshot.clone());
        let previous_state = self.current_slice_state.unwrap_or(observed_state);
        let duration_seconds = (now - started_at).num_seconds().max(1);
        let snapshot_changed = previous_snapshot != snapshot;
        let state_changed = previous_state != observed_state;
        let hit_segment_limit = duration_seconds >= MAX_SLICE_SECONDS;

        if !force_flush && !snapshot_changed && !state_changed && !hit_segment_limit {
            self.status.state = observed_state;
            self.status.last_app_name = snapshot.app_name;
            self.status.last_window_title = snapshot.window_title;
            return;
        }

        let payload = ActivityEventPayload {
            device_id: self.status.device_id.clone(),
            device_name: self.status.device_name.clone(),
            platform: std::env::consts::OS.to_owned(),
            app_name: previous_snapshot.app_name.clone(),
            window_title: previous_snapshot.window_title.clone(),
            state: previous_state,
            started_at: started_at.to_rfc3339(),
            ended_at: now.to_rfc3339(),
            duration_seconds,
            captured_at: now.to_rfc3339(),
            source: "desktop-agent".to_owned(),
            session_id: self.current_session_id.clone(),
            url: None,
            domain: None,
            classification: None,
        };

        self.status.tracked_seconds_total += duration_seconds;
        self.send_or_queue(QueueItem::Activity { payload });

        if force_flush {
            self.reset_current_slice();
            return;
        }

        self.begin_new_slice(now, snapshot, observed_state, snapshot_changed || state_changed);
    }

    fn send_heartbeat(&mut self) {
        let snapshot = if self.status.state.is_running() {
            let current_snapshot = self.capture_snapshot();
            self.status.state = self.observed_state();
            current_snapshot
        } else {
            WindowSnapshot {
                app_name: if self.status.last_app_name.is_empty() {
                    "Tracking stopped".to_owned()
                } else {
                    self.status.last_app_name.clone()
                },
                window_title: if self.status.last_window_title.is_empty() {
                    "Start tracking to capture foreground activity".to_owned()
                } else {
                    self.status.last_window_title.clone()
                },
            }
        };

        self.status.last_app_name = snapshot.app_name.clone();
        self.status.last_window_title = snapshot.window_title.clone();

        let payload = HeartbeatPayload {
            device_id: self.status.device_id.clone(),
            device_name: self.status.device_name.clone(),
            platform: std::env::consts::OS.to_owned(),
            status: self.status.state,
            captured_at: Utc::now().to_rfc3339(),
            last_app_name: Some(snapshot.app_name),
            last_window_title: Some(snapshot.window_title),
            source: Some("desktop-agent".to_owned()),
            last_url: None,
            last_domain: None,
            last_classification: None,
        };

        self.send_or_queue(QueueItem::Heartbeat { payload });
    }
}

struct AppState {
    sender: Mutex<Sender<AgentCommand>>,
    shared: Arc<Mutex<UiState>>,
}

#[tauri::command]
fn get_status(state: State<AppState>) -> AgentStatus {
    state.shared.lock().status.clone()
}

fn send_and_snapshot(state: &State<AppState>, command: AgentCommand) -> AgentStatus {
    let _ = state.sender.lock().send(command);
    thread::sleep(Duration::from_millis(250));
    state.shared.lock().status.clone()
}

#[tauri::command]
fn start_tracking(state: State<AppState>) -> AgentStatus {
    send_and_snapshot(&state, AgentCommand::Start)
}

#[tauri::command]
fn pause_tracking(state: State<AppState>) -> AgentStatus {
    send_and_snapshot(&state, AgentCommand::Pause)
}

#[tauri::command]
fn stop_tracking(state: State<AppState>) -> AgentStatus {
    send_and_snapshot(&state, AgentCommand::Stop)
}

#[tauri::command]
fn save_settings(
    state: State<AppState>,
    api_url: String,
    api_token: String,
    excluded_apps: Vec<String>,
) -> AgentStatus {
    send_and_snapshot(
        &state,
        AgentCommand::SaveSettings {
            api_url,
            api_token,
            excluded_apps,
        },
    )
}

fn computer_name() -> String {
    std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Windows Device".to_owned())
}

fn runtime_files() -> RuntimeFiles {
    let base_dir = ProjectDirs::from("com", "mini-analytics", "agent")
        .map(|dirs| dirs.data_local_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from(".agent-runtime"));
    let _ = fs::create_dir_all(&base_dir);
    RuntimeFiles {
        settings_path: base_dir.join("settings.json"),
        sqlite_path: base_dir.join("activity-outbox.sqlite"),
    }
}

fn load_settings(path: &PathBuf) -> AgentSettings {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<AgentSettings>(&content).ok())
        .unwrap_or_default()
}

fn open_sqlite(path: &PathBuf) -> Connection {
    let connection = Connection::open(path).expect("failed to open local sqlite database");
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS pending_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ",
        )
        .expect("failed to initialize sqlite schema");
    connection
}

fn count_pending_items(connection: &Connection) -> usize {
    connection
        .query_row("SELECT COUNT(*) FROM pending_events", [], |row| row.get::<_, i64>(0))
        .map(|count| count.max(0) as usize)
        .unwrap_or(0)
}

fn insert_pending_item(connection: &Connection, item: &QueueItem) {
    let kind = match item {
        QueueItem::Activity { .. } => "activity",
        QueueItem::Heartbeat { .. } => "heartbeat",
    };
    if let Ok(payload) = serde_json::to_string(item) {
        let _ = connection.execute(
            "INSERT INTO pending_events (kind, payload) VALUES (?1, ?2)",
            params![kind, payload],
        );
    }
}

fn load_pending_items(connection: &Connection, limit: usize) -> Vec<PendingRecord> {
    let mut statement = match connection
        .prepare("SELECT id, payload FROM pending_events ORDER BY id ASC LIMIT ?1")
    {
        Ok(statement) => statement,
        Err(_) => return Vec::new(),
    };

    let rows = match statement.query_map(params![limit as i64], |row| {
        let id = row.get::<_, i64>(0)?;
        let payload = row.get::<_, String>(1)?;
        Ok((id, payload))
    }) {
        Ok(rows) => rows,
        Err(_) => return Vec::new(),
    };

    rows.filter_map(|row| {
        let (id, payload) = row.ok()?;
        let item = serde_json::from_str::<QueueItem>(&payload).ok()?;
        Some(PendingRecord { id, item })
    })
    .collect()
}

fn delete_pending_items(connection: &mut Connection, ids: &[i64]) {
    if ids.is_empty() {
        return;
    }
    let transaction = match connection.transaction() {
        Ok(tx) => tx,
        Err(_) => return,
    };
    if let Ok(mut statement) = transaction.prepare("DELETE FROM pending_events WHERE id = ?1") {
        for id in ids {
            let _ = statement.execute(params![id]);
        }
    }
    let _ = transaction.commit();
}

fn foreground_window_snapshot() -> WindowSnapshot {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.is_null() {
        return WindowSnapshot {
            app_name: "Desktop".to_owned(),
            window_title: "No visible window detected".to_owned(),
        };
    }
    let window_title = window_title_from_hwnd(hwnd);
    let app_name = process_name_from_hwnd(hwnd).unwrap_or_else(|| "Desktop".to_owned());
    WindowSnapshot {
        app_name,
        window_title: if window_title.trim().is_empty() {
            "No visible window detected".to_owned()
        } else {
            window_title
        },
    }
}

fn window_title_from_hwnd(hwnd: HWND) -> String {
    let length = unsafe { GetWindowTextLengthW(hwnd) };
    if length <= 0 {
        return String::new();
    }
    let mut buffer = vec![0u16; (length + 1) as usize];
    let written = unsafe { GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32) };
    if written <= 0 {
        return String::new();
    }
    String::from_utf16_lossy(&buffer[..written as usize])
}

fn process_name_from_hwnd(hwnd: HWND) -> Option<String> {
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
    if pid == 0 {
        return None;
    }
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if process.is_null() {
        return None;
    }
    let mut size = 512u32;
    let mut buffer = vec![0u16; size as usize];
    let result =
        unsafe { QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut size) };
    unsafe { CloseHandle(process) };
    if result == 0 || size == 0 {
        return None;
    }
    let full_path = String::from_utf16_lossy(&buffer[..size as usize]);
    let path = PathBuf::from(full_path);
    path.file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
}

fn spawn_worker(shared: Arc<Mutex<UiState>>, receiver: Receiver<AgentCommand>) {
    thread::spawn(move || {
        let files = runtime_files();
        let mut runtime = WorkerRuntime::new(files);
        runtime.persist_settings();
        runtime.push_status(&shared);
        runtime.send_heartbeat();
        runtime.push_status(&shared);

        let mut last_sample = Instant::now();
        let mut last_heartbeat = Instant::now();
        let mut last_flush = Instant::now();

        loop {
            while let Ok(command) = receiver.try_recv() {
                runtime.handle_command(command);
                runtime.push_status(&shared);
            }

            if runtime.status.state.is_running() && last_sample.elapsed() >= SAMPLE_INTERVAL {
                runtime.capture_and_send_slice(false);
                last_sample = Instant::now();
                runtime.push_status(&shared);
            }

            if last_heartbeat.elapsed() >= HEARTBEAT_INTERVAL {
                runtime.send_heartbeat();
                last_heartbeat = Instant::now();
                runtime.push_status(&shared);
            }

            if runtime.status.pending_queue_count > 0 && last_flush.elapsed() >= HEARTBEAT_INTERVAL
            {
                runtime.flush_queue();
                last_flush = Instant::now();
                runtime.push_status(&shared);
            }

            thread::sleep(Duration::from_millis(250));
        }
    });
}

fn main() {
    let settings = load_settings(&runtime_files().settings_path);
    let shared = Arc::new(Mutex::new(UiState {
        status: AgentStatus::from_settings(&settings),
    }));
    let (sender, receiver) = mpsc::channel();
    spawn_worker(shared.clone(), receiver);

    tauri::Builder::default()
        .manage(AppState {
            sender: Mutex::new(sender),
            shared,
        })
        .invoke_handler(tauri::generate_handler![
            get_status,
            start_tracking,
            pause_tracking,
            stop_tracking,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
