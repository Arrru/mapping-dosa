# VN Scene Mapping Tool

비개발자(디자이너/기획자)가 코딩 없이 Godot 비주얼노벨 장면을 만들 수 있는 가벼운 웹 툴.

- **에셋 소스**: [Arrru/dosa](https://github.com/Arrru/dosa)
- **출력 저장소**: [Arrru/mapping-dosa](https://github.com/Arrru/mapping-dosa)

---

## 1. 전체 아키텍처

```
[Arrru/dosa GitHub API]
        ↓ 에셋 목록 자동 로드 (1 API 요청)
[브라우저 웹앱 — index.html]
 ├─ 왼쪽:   에셋 패널 (BG / 캐릭터 / BGM / SFX / UI 탭, 썸네일, 드래그)
 ├─ 중앙:   씬 프리뷰 (배경 + 캐릭터 좌/중앙/우 + 대사창)
 └─ 오른쪽: 타임라인 + 이벤트 에디터
        ↓ 내보내기
[scene.json + asset_manifest.json]
        ↓ GitHub API PUT
[Arrru/mapping-dosa/scenes/]
        ↓ Godot이 읽음
[NovelPlayer.gd — 런타임 재생]
```

---

## 2. 폴더 구조

```
mapping-tools/
├── index.html              # 앱 진입점 (3분할 레이아웃)
├── css/style.css           # 다크 테마, CSS 변수 디자인 시스템
├── js/
│   ├── utils.js            # 유틸리티 (ID 생성, 경로 변환, 에셋 분류)
│   ├── state.js            # AppState 싱글톤 (undo/redo, autosave)
│   ├── github-api.js       # GitHub REST API (tree fetch, push, token test)
│   ├── asset-manager.js    # 에셋 로드 + manifest 생성
│   ├── preview.js          # 중앙 프리뷰 패널 (드래그-드롭, 캐릭터 배치)
│   ├── timeline.js         # 타임라인 + 이벤트 에디터 폼
│   ├── exporter.js         # scene.json 생성 + GitHub push
│   └── app.js              # EventBus + AssetPanelUI + 초기화 + 단축키
└── godot/NovelPlayer.gd    # Godot 4.x 재생 스크립트
```

---

## 3. `asset_manifest.json` 구조

```json
{
  "version": "1.0",
  "generated_at": "2026-04-25T00:00:00Z",
  "source_repo": "Arrru/dosa",
  "assets": {
    "backgrounds": [
      {
        "id":       "background_library_east",
        "filename": "library_east",
        "path":     "project/assets/backgrounds/library_east.svg",
        "resPath":  "res://project/assets/backgrounds/library_east.svg",
        "rawUrl":   "https://raw.githubusercontent.com/Arrru/dosa/main/project/assets/backgrounds/library_east.svg"
      }
    ],
    "characters": [ "..." ],
    "bgm":        [ "..." ],
    "sfx":        [ "..." ],
    "ui":         [ "..." ]
  }
}
```

| 필드 | 설명 |
|---|---|
| `id` | `{type}_{filename}` 형식 고유 ID |
| `filename` | 확장자 제외 파일명 |
| `path` | 저장소 내 상대 경로 |
| `resPath` | Godot `res://` 경로 |
| `rawUrl` | GitHub raw URL (미리보기용) |

---

## 4. `scene.json` 구조

```json
{
  "scene_id":   "scene_001",
  "title":      "도서관 씬",
  "version":    "1.0",
  "created_at": "2026-04-25T12:00:00Z",
  "events": [
    { "id": "evt_001", "type": "background",
      "asset_id": "background_library_east",
      "path": "res://project/assets/backgrounds/library_east.svg" },

    { "id": "evt_002", "type": "bgm_play",
      "asset_id": "bgm_bensound", "loop": true,
      "path": "res://assets/sounds/bensound-sadday.mp3" },

    { "id": "evt_003", "type": "bgm_stop" },

    { "id": "evt_004", "type": "sfx_play",
      "asset_id": "sfx_click",
      "path": "res://assets/sounds/click.mp3" },

    { "id": "evt_005", "type": "character_show",
      "character_id": "catalog_warden",
      "position": "center", "expression": "normal",
      "path": "res://project/assets/portraits/catalog_warden.svg" },

    { "id": "evt_006", "type": "character_hide",
      "character_id": "catalog_warden" },

    { "id": "evt_007", "type": "expression_change",
      "character_id": "catalog_warden", "expression": "smile",
      "path": "res://project/assets/portraits/catalog_warden_smile.svg" },

    { "id": "evt_008", "type": "dialogue",
      "speaker": "사서", "text": "어서오세요.", "voice": null },

    { "id": "evt_009", "type": "choice",
      "prompt": "어떻게 할까요?",
      "options": [
        { "text": "책을 빌린다", "next_scene": "scene_002", "variable_set": null },
        { "text": "돌아간다",   "next_scene": "scene_003", "variable_set": null }
      ]}
  ]
}
```

### 지원 이벤트 타입

| 타입 | 설명 |
|---|---|
| `background` | 배경 이미지 변경 |
| `bgm_play` | BGM 재생 (`loop` 옵션) |
| `bgm_stop` | BGM 정지 |
| `sfx_play` | 효과음 1회 재생 |
| `character_show` | 캐릭터 등장 (`position`: left / center / right) |
| `character_hide` | 캐릭터 퇴장 |
| `expression_change` | 캐릭터 표정 변경 |
| `dialogue` | 대사 표시 (타자기 효과) |
| `choice` | 선택지 + 씬 분기 |

---

## 5. UI 와이어프레임

```
┌──────────────────────────────────────────────────────────────────┐
│ 🎬 VN Scene Mapper  [새 장면] [저장] [불러오기] [JSON내보내기]   │
│                     [GitHub푸시] [설정] [↩Undo] [↪Redo]         │
├────────────────┬─────────────────────────┬──────────────────────┤
│ ASSET PANEL    │   SCENE PREVIEW (16:9)  │ TIMELINE             │
│ ─────────────  │  ┌─────────────────────┐│ ────────────────     │
│ [BG][캐릭터]   │  │  library_east.svg   ││ [0] 🖼  배경:east    │
│ [BGM][SFX][UI] │  │                     ││ [1] 🎵  BGM:bensound │
│ [최근사용]     │  │  [👤L][👤C][👤R]    ││ [2] 👤  캐릭터:center│
│ ─────────────  │  │   catalog_warden    ││ [3] 💬  "어서오세요."│
│ 🔍 검색        │  │                     ││ [4] 🔀  선택지 2개   │
│                │  └─────────────────────┘│ ────────────────     │
│ [이미지카드]   │  ┌─────────────────────┐│ [+ 이벤트 추가]      │
│ [이미지카드]   │  │ 사서                ││ ════════════════     │
│ [이미지카드]   │  │ "어서오세요."       ││ EDITOR (선택됨)      │
│ [♪ bgm]  ▶    │  └─────────────────────┘│ 대사: ___________    │
│                │  ← 드래그하여 배치      │ 화자: ___________    │
└────────────────┴─────────────────────────┴──────────────────────┘
```

---

## 6. 각 UI 컴포넌트 역할

| 컴포넌트 | 파일 | 역할 |
|---|---|---|
| `AssetManager` | `asset-manager.js` | GitHub API로 에셋 로드, manifest 생성 |
| `PreviewPanel` | `preview.js` | 드래그-드롭 수신, 캐릭터 배치, 대사 렌더링 |
| `TimelinePanel` | `timeline.js` | 이벤트 목록, 순서 변경, 에디터 폼 |
| `AssetPanelUI` | `app.js` | 탭별 에셋 카드, 썸네일/오디오 미리보기 |
| `Exporter` | `exporter.js` | scene.json 생성, GitHub push, import |
| `AppState` | `state.js` | 중앙 상태, undo/redo 스택, autosave |
| `EventBus` | `app.js` | 패널 간 이벤트 통신 (pub/sub) |
| `GitHubAPI` | `github-api.js` | GitHub REST API 래퍼 |

---

## 7. `NovelPlayer.gd` 구조 (Godot 4.x)

```
필요 자식 노드:
  Background       TextureRect       전체화면 배경
  CharLeft         TextureRect       좌측 캐릭터
  CharCenter       TextureRect       중앙 캐릭터
  CharRight        TextureRect       우측 캐릭터
  DialogueBox      Panel             하단 대사창
  SpeakerLabel     Label             화자 이름
  DialogueText     RichTextLabel     타자기 대사
  ChoiceContainer  VBoxContainer     선택지 버튼
  AudioBGM         AudioStreamPlayer BGM 재생
  AudioSFX         AudioStreamPlayer 효과음 재생

공개 메서드:
  load_scene(path: String)   JSON 로드 및 파싱
  start()                    이벤트 인덱스 0부터 재생
  advance()                  다음 이벤트 (클릭/스페이스)

시그널:
  scene_completed(scene_id)
  choice_made(option_text, next_scene)
```

---

## 8. 데이터 흐름

```
Git (Arrru/dosa)
    │
    │  ① GET /repos/Arrru/dosa/git/trees/main?recursive=1
    │     단 1번의 API 요청으로 전체 파일 목록 수집
    ▼
asset_manifest.json 자동 생성
    │  에셋 패널에 썸네일 / 오디오 플레이어 표시
    ▼
디자이너가 드래그&드롭으로 씬 구성
    │  AppState.scene.events[] 에 이벤트 누적
    │  30초마다 localStorage 자동저장
    ▼
scene.json 생성 (Exporter)
    │
    │  ② PUT /repos/Arrru/mapping-dosa/contents/scenes/{id}.json
    │  ③ PUT /repos/Arrru/mapping-dosa/contents/asset_manifest.json
    ▼
Godot: NovelPlayer.load_scene("res://scenes/scene_001.json")
    │
    ▼
런타임 비주얼노벨 재생
```

---

## 9. 사용 방법

1. 브라우저에서 `index.html` 열기 (또는 GitHub Pages 배포)
2. **[설정]** 클릭 → GitHub Personal Access Token 입력
   - `Arrru/mapping-dosa`에 쓰기 권한이 있는 토큰 필요
3. 앱이 `Arrru/dosa` 에셋을 자동으로 불러옴
4. 왼쪽 패널에서 배경 이미지를 중앙 화면으로 **드래그**
5. 캐릭터를 드래그하여 좌/중앙/우 슬롯에 배치
6. 오른쪽 타임라인 **[+ 이벤트 추가]** 로 대사/선택지 작성
7. **[JSON 내보내기]** 또는 **[GitHub 푸시]** 클릭

### 키보드 단축키

| 단축키 | 기능 |
|---|---|
| `Ctrl+Z` | 실행 취소 |
| `Ctrl+Y` | 다시 실행 |
| `Ctrl+S` | 로컬 저장 (JSON 다운로드) |
| `Ctrl+Shift+S` | scene.json 내보내기 |
| `Esc` | 모달 닫기 |
