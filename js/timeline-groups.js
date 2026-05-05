/**
 * timeline-groups.js
 * 타임라인 이벤트 그룹화 유틸리티
 *
 * 데이터 구조:
 *   AppState.scene.groups  : [{ id, name, collapsed }]
 *   AppState.scene.events  : 각 이벤트에 optional groupId 필드
 *
 * 중첩 그룹은 지원하지 않습니다 (1단계).
 */

'use strict';

window.TimelineGroups = (function () {

  /** AppState.scene.groups 배열을 안전하게 반환 (없으면 초기화) */
  function _groups() {
    if (!AppState.scene.groups) AppState.scene.groups = [];
    return AppState.scene.groups;
  }

  // ─────────────────────────────────────────────────────────────
  // 공개 함수
  // ─────────────────────────────────────────────────────────────

  /**
   * 선택된 이벤트 인덱스들을 하나의 그룹으로 묶습니다.
   * 이미 다른 그룹에 속한 이벤트는 자동으로 제외됩니다 (중첩 미지원).
   *
   * @param {string}   groupName       그룹 이름
   * @param {number[]} selectedIndices 그룹화할 AppState.scene.events 인덱스 배열
   *                                   (생략 시 AppState.ui.selectedEventIndices 사용)
   * @returns {string|null} 생성된 그룹 ID, 유효 항목이 없으면 null
   */
  function group_selected_items(groupName, selectedIndices) {
    const events = AppState.scene.events;
    const groups = _groups();

    const indices = selectedIndices || (AppState.ui.selectedEventIndices || []);
    if (!indices || indices.length === 0) return null;

    // 이미 그룹에 속한 이벤트는 제외 (중첩 그룹 미지원)
    const valid = indices.filter(function (i) {
      const evt = events[i];
      return evt && !evt.groupId;
    });
    if (valid.length === 0) return null;

    AppState.saveToHistory();

    const groupId = 'grp_' + Utils.generateId();
    const name = (groupName && groupName.trim()) || ('새 그룹 ' + (groups.length + 1));

    groups.push({ id: groupId, name: name, collapsed: false });

    valid.forEach(function (i) {
      events[i].groupId = groupId;
    });

    AppState.ui.selectedEventIndices = [];
    AppState.autosave();
    EventBus.emit('timeline:updated');

    return groupId;
  }

  /**
   * 그룹을 해제하고 내부 이벤트들의 groupId를 제거합니다.
   * 이벤트 순서는 그대로 유지됩니다.
   *
   * @param {string} groupId
   */
  function ungroup_item(groupId) {
    const events = AppState.scene.events;
    const groups = _groups();

    AppState.saveToHistory();

    events.forEach(function (evt) {
      if (evt.groupId === groupId) delete evt.groupId;
    });

    const idx = groups.findIndex(function (g) { return g.id === groupId; });
    if (idx !== -1) groups.splice(idx, 1);

    AppState.autosave();
    EventBus.emit('timeline:updated');
  }

  /**
   * 그룹의 접힘/펼침 상태를 토글합니다.
   * (히스토리에 저장하지 않습니다 — UI 상태로 취급)
   *
   * @param {string} groupId
   */
  function toggle_group_collapsed(groupId) {
    const group = _groups().find(function (g) { return g.id === groupId; });
    if (!group) return;
    group.collapsed = !group.collapsed;
    AppState.autosave();
    EventBus.emit('timeline:updated');
  }

  /**
   * 타임라인에 표시할 아이템 목록을 반환합니다.
   * 접힌 그룹의 내부 이벤트는 제외하고, 그룹 헤더를 삽입합니다.
   *
   * 반환 아이템 형식:
   *   { kind: 'group_header', group: Object, eventCount: number }
   *   { kind: 'event', eventIndex: number, event: Object, groupId: string|null, indented: boolean }
   *
   * @returns {Array}
   */
  function get_visible_timeline_items() {
    const events = AppState.scene.events;
    const groups = _groups();

    // groupId → group 객체 빠른 조회
    const groupMap = {};
    groups.forEach(function (g) { groupMap[g.id] = g; });

    const items = [];
    const emittedGroupIds = {};

    for (var i = 0; i < events.length; i++) {
      var event = events[i];
      var groupId = event.groupId || null;

      if (!groupId) {
        items.push({ kind: 'event', eventIndex: i, event: event, groupId: null, indented: false });
        continue;
      }

      var group = groupMap[groupId];
      if (!group) {
        // 고아 이벤트 (그룹 메타 없음) → 일반 항목으로 표시
        items.push({ kind: 'event', eventIndex: i, event: event, groupId: null, indented: false });
        continue;
      }

      // 이 그룹의 헤더를 아직 추가하지 않았으면 추가
      if (!emittedGroupIds[groupId]) {
        emittedGroupIds[groupId] = true;
        var eventCount = events.filter(function (e) { return e.groupId === groupId; }).length;
        items.push({ kind: 'group_header', group: group, eventCount: eventCount });
      }

      // 펼쳐진 그룹만 내부 이벤트 표시
      if (!group.collapsed) {
        items.push({ kind: 'event', eventIndex: i, event: event, groupId: groupId, indented: true });
      }
    }

    return items;
  }

  /**
   * 그룹 내 이벤트 타입별 요약 문자열을 반환합니다.
   * 예: "대사 5개 · 이미지 3개 · BGM 1개"
   *
   * @param {Object} group  { id, name, collapsed }
   * @returns {string}
   */
  function get_group_summary(group) {
    var events = AppState.scene.events.filter(function (e) { return e.groupId === group.id; });
    if (events.length === 0) return '항목 없음';

    var LABELS = {
      dialogue:          '대사',
      place:             '이미지',
      bgm_play:          'BGM',
      bgm_stop:          'BGM',
      sfx_play:          '효과음',
      choice:            '선택지',
      background:        '배경',
      character_show:    '캐릭터',
      character_hide:    '캐릭터',
      expression_change: '표정',
    };

    var counts = {};
    events.forEach(function (e) {
      var label = LABELS[e.type] || e.type;
      counts[label] = (counts[label] || 0) + 1;
    });

    return Object.keys(counts).map(function (label) {
      return label + ' ' + counts[label] + '개';
    }).join(' · ');
  }

  // ─────────────────────────────────────────────────────────────
  // 공개 API
  // ─────────────────────────────────────────────────────────────

  return {
    group_selected_items:      group_selected_items,
    ungroup_item:              ungroup_item,
    toggle_group_collapsed:    toggle_group_collapsed,
    get_visible_timeline_items: get_visible_timeline_items,
    get_group_summary:         get_group_summary,
  };

})();
