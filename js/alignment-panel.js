/**
 * alignment-panel.js
 * 정렬 도구 패널 — AlignmentUtils를 에셋 패널 하단 UI에 연결합니다.
 */
'use strict';

window.AlignmentPanel = (() => {

  /** AppState.scene.events 에서 자유 배치(place) 이벤트만 추출 */
  function getPlaceEvents() {
    return AppState.scene.events.filter(function(e) { return e.type === 'place'; });
  }

  /**
   * 정렬 함수를 실행하고 결과를 씬에 반영한다.
   * @param {Function} fn  AlignmentUtils의 정렬 함수
   */
  function applyFn(fn) {
    var events = getPlaceEvents();
    if (events.length === 0) return;

    AppState.saveToHistory();

    var result = fn(events);

    result.forEach(function(aligned) {
      var idx = AppState.scene.events.findIndex(function(e) { return e.id === aligned.id; });
      if (idx !== -1) {
        AppState.scene.events[idx] = Object.assign({}, AppState.scene.events[idx], {
          rect: Object.assign({}, aligned.rect)
        });
      }
    });

    EventBus.emit('timeline:updated');
    EventBus.emit('preview:updated');
  }

  /** 배치 개수 표시 업데이트 */
  function refreshCount() {
    var el = document.getElementById('align-target-count');
    if (!el) return;
    var n = getPlaceEvents().length;
    el.textContent = '배치 ' + n + '개';
  }

  /** 버튼 활성/비활성 상태 업데이트 */
  function refreshButtons() {
    var n = getPlaceEvents().length;
    document.querySelectorAll('.btn-align[data-action]').forEach(function(btn) {
      var action = btn.dataset.action;
      var min = (action === 'distribute_horizontal' || action === 'distribute_vertical') ? 3 : 2;
      btn.disabled = n < min;
    });
    var gridBtn = document.getElementById('btn-align-grid');
    if (gridBtn) gridBtn.disabled = n < 2;
  }

  function init() {
    // 씬 변경 시 카운트·버튼 상태 갱신
    EventBus.on('timeline:updated', refreshCount);
    EventBus.on('timeline:updated', refreshButtons);
    EventBus.on('preview:updated', refreshCount);
    EventBus.on('preview:updated', refreshButtons);

    refreshCount();
    refreshButtons();

    // 정렬 / 균등 배치 버튼
    document.querySelectorAll('.btn-align[data-action]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var action = btn.dataset.action;
        var fn = AlignmentUtils[action];
        if (typeof fn !== 'function') return;
        applyFn(fn);
      });
    });

    // 그리드 배치 버튼
    var gridBtn = document.getElementById('btn-align-grid');
    if (gridBtn) {
      gridBtn.addEventListener('click', function() {
        var cols = parseInt(document.getElementById('align-grid-cols').value, 10) || 3;
        applyFn(function(objs) {
          return AlignmentUtils.auto_grid_layout(objs, 1.0, cols, {
            paddingX: 0.02,
            paddingY: 0.03,
            originX: 0,
            originY: 0,
          });
        });
      });
    }
  }

  return { init: init };
})();
