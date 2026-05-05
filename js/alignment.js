/**
 * alignment.js
 * PPT 스타일 정렬, 균등 배치, 그리드 레이아웃 유틸리티
 *
 * 모든 좌표는 씬 에디터와 동일한 정규화 좌표계(0.0 ~ 1.0)를 사용합니다.
 * 원본 객체를 변경하지 않고 복사본을 반환합니다.
 */

'use strict';

(function (global) {

  /** 스냅 기준 거리 (픽셀). snap_to_guides() 호출 시 캔버스 크기와 함께 사용 */
  const SNAP_DISTANCE_PX = 8;

  // ─────────────────────────────────────────────────────────────────
  // 내부 헬퍼
  // ─────────────────────────────────────────────────────────────────

  /**
   * 객체를 얕게 복사하되 rect만 교체한 새 객체를 반환합니다.
   * @param {Object} obj
   * @param {Object} newRect  { x, y, w, h }
   * @returns {Object}
   */
  function _clone(obj, newRect) {
    return Object.assign({}, obj, { rect: Object.assign({}, newRect) });
  }

  /**
   * 객체의 rect에서 각 기준선(left, centerX, right, top, centerY, bottom)을 계산합니다.
   * @param {Object} obj  rect: { x, y, w, h } 를 가진 객체
   * @returns {{ left, centerX, right, top, centerY, bottom }}
   */
  function getBounds(obj) {
    const { x, y, w, h } = obj.rect;
    return {
      left:    x,
      right:   x + w,
      top:     y,
      bottom:  y + h,
      centerX: x + w / 2,
      centerY: y + h / 2,
    };
  }

  /**
   * 여러 객체를 감싸는 최소 바운딩 박스를 계산합니다.
   * @param {Array} objects
   * @returns {{ left, right, top, bottom, centerX, centerY }}
   */
  function _unionBounds(objects) {
    const left   = Math.min(...objects.map(o => o.rect.x));
    const top    = Math.min(...objects.map(o => o.rect.y));
    const right  = Math.max(...objects.map(o => o.rect.x + o.rect.w));
    const bottom = Math.max(...objects.map(o => o.rect.y + o.rect.h));
    return { left, top, right, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
  }

  // ─────────────────────────────────────────────────────────────────
  // 1.1  정렬 함수 (Align)
  // ─────────────────────────────────────────────────────────────────

  /**
   * 모든 객체의 왼쪽 가장자리를 가장 왼쪽 객체에 맞춥니다.
   * @param {Array} objects
   * @returns {Array}
   */
  function align_left(objects) {
    if (!objects || objects.length === 0) return [];
    const anchor = _unionBounds(objects).left;
    return objects.map(o => _clone(o, Object.assign({}, o.rect, { x: anchor })));
  }

  /**
   * 모든 객체의 수평 중심을 선택 영역 전체의 가로 중앙에 맞춥니다.
   * @param {Array} objects
   * @returns {Array}
   */
  function align_center_horizontal(objects) {
    if (!objects || objects.length === 0) return [];
    const anchor = _unionBounds(objects).centerX;
    return objects.map(o => _clone(o, Object.assign({}, o.rect, { x: anchor - o.rect.w / 2 })));
  }

  /**
   * 모든 객체의 오른쪽 가장자리를 가장 오른쪽 객체에 맞춥니다.
   * @param {Array} objects
   * @returns {Array}
   */
  function align_right(objects) {
    if (!objects || objects.length === 0) return [];
    const anchor = _unionBounds(objects).right;
    return objects.map(o => _clone(o, Object.assign({}, o.rect, { x: anchor - o.rect.w })));
  }

  /**
   * 모든 객체의 위쪽 가장자리를 가장 위쪽 객체에 맞춥니다.
   * @param {Array} objects
   * @returns {Array}
   */
  function align_top(objects) {
    if (!objects || objects.length === 0) return [];
    const anchor = _unionBounds(objects).top;
    return objects.map(o => _clone(o, Object.assign({}, o.rect, { y: anchor })));
  }

  /**
   * 모든 객체의 수직 중심을 선택 영역 전체의 세로 중앙에 맞춥니다.
   * @param {Array} objects
   * @returns {Array}
   */
  function align_middle_vertical(objects) {
    if (!objects || objects.length === 0) return [];
    const anchor = _unionBounds(objects).centerY;
    return objects.map(o => _clone(o, Object.assign({}, o.rect, { y: anchor - o.rect.h / 2 })));
  }

  /**
   * 모든 객체의 아래쪽 가장자리를 가장 아래쪽 객체에 맞춥니다.
   * @param {Array} objects
   * @returns {Array}
   */
  function align_bottom(objects) {
    if (!objects || objects.length === 0) return [];
    const anchor = _unionBounds(objects).bottom;
    return objects.map(o => _clone(o, Object.assign({}, o.rect, { y: anchor - o.rect.h })));
  }

  // ─────────────────────────────────────────────────────────────────
  // 1.2  균등 배치 함수 (Distribute)
  // ─────────────────────────────────────────────────────────────────

  /**
   * 객체들을 수평 방향으로 동일한 간격으로 배치합니다.
   * 가장 왼쪽과 가장 오른쪽 객체는 고정되며,
   * 나머지 객체들이 그 사이에서 균등하게 재배치됩니다.
   * 객체가 2개 이하이면 복사본만 반환합니다.
   * @param {Array} objects
   * @returns {Array}
   */
  function distribute_horizontal(objects) {
    if (!objects || objects.length < 3) {
      return objects.map(o => _clone(o, o.rect));
    }

    // 왼쪽 가장자리 기준으로 정렬
    const sorted = objects.slice().sort((a, b) => a.rect.x - b.rect.x);

    const first     = sorted[0];
    const last      = sorted[sorted.length - 1];
    const totalSpan = getBounds(last).right - first.rect.x;
    const totalW    = sorted.reduce((sum, o) => sum + o.rect.w, 0);

    // 인접 객체 사이의 균등 간격
    const gap = (totalSpan - totalW) / (sorted.length - 1);

    let cursor = first.rect.x;
    return sorted.map((obj) => {
      const result = _clone(obj, Object.assign({}, obj.rect, { x: cursor }));
      cursor += obj.rect.w + gap;
      return result;
    });
  }

  /**
   * 객체들을 수직 방향으로 동일한 간격으로 배치합니다.
   * 가장 위쪽과 가장 아래쪽 객체는 고정되며,
   * 나머지 객체들이 그 사이에서 균등하게 재배치됩니다.
   * 객체가 2개 이하이면 복사본만 반환합니다.
   * @param {Array} objects
   * @returns {Array}
   */
  function distribute_vertical(objects) {
    if (!objects || objects.length < 3) {
      return objects.map(o => _clone(o, o.rect));
    }

    // 위쪽 가장자리 기준으로 정렬
    const sorted = objects.slice().sort((a, b) => a.rect.y - b.rect.y);

    const first     = sorted[0];
    const last      = sorted[sorted.length - 1];
    const totalSpan = getBounds(last).bottom - first.rect.y;
    const totalH    = sorted.reduce((sum, o) => sum + o.rect.h, 0);

    // 인접 객체 사이의 균등 간격
    const gap = (totalSpan - totalH) / (sorted.length - 1);

    let cursor = first.rect.y;
    return sorted.map((obj) => {
      const result = _clone(obj, Object.assign({}, obj.rect, { y: cursor }));
      cursor += obj.rect.h + gap;
      return result;
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // 1.2 보조  스냅 헬퍼 (Snap to Guides)
  // ─────────────────────────────────────────────────────────────────

  /**
   * 객체 목록으로부터 정렬 기준선(가이드) 목록을 생성합니다.
   * 각 객체마다 left, centerX, right, top, centerY, bottom 6개의 가이드를 생성합니다.
   * @param {Array} objects
   * @returns {Array<{ axis: 'x'|'y', value: number, type: string }>}
   */
  function computeGuides(objects) {
    const guides = [];
    objects.forEach(function (o) {
      const b = getBounds(o);
      guides.push({ axis: 'x', value: b.left,    type: 'left'    });
      guides.push({ axis: 'x', value: b.centerX,  type: 'centerX' });
      guides.push({ axis: 'x', value: b.right,   type: 'right'   });
      guides.push({ axis: 'y', value: b.top,     type: 'top'     });
      guides.push({ axis: 'y', value: b.centerY,  type: 'centerY' });
      guides.push({ axis: 'y', value: b.bottom,  type: 'bottom'  });
    });
    return guides;
  }

  /**
   * rect를 가이드 선에 스냅합니다.
   * SNAP_DISTANCE_PX 이내의 가이드에 가장자리 또는 중심이 가까우면 자동으로 맞춥니다.
   *
   * 검사 기준선: left, centerX, right (x축) / top, centerY, bottom (y축)
   *
   * @param {Object} rect          정규화 좌표 { x, y, w, h }
   * @param {Array}  guides        computeGuides() 의 반환값
   * @param {number} canvasWidth   미리보기 캔버스 픽셀 너비 (스냅 임계값 변환에 사용)
   * @param {number} canvasHeight  미리보기 캔버스 픽셀 높이 (스냅 임계값 변환에 사용)
   * @returns {Object} 스냅이 적용된 새 rect
   */
  function snap_to_guides(rect, guides, canvasWidth, canvasHeight) {
    // 8px → 정규화 좌표계 임계값으로 변환
    const threshX = SNAP_DISTANCE_PX / canvasWidth;
    const threshY = SNAP_DISTANCE_PX / canvasHeight;

    var snappedX = rect.x;
    var snappedY = rect.y;

    // 각 축에서 검사할 (기준점, 스냅 시 x/y 보정 오프셋) 쌍
    var checkX = [
      { from: rect.x,               offset: 0            },  // 왼쪽 가장자리
      { from: rect.x + rect.w / 2,  offset: -rect.w / 2  },  // 수평 중심
      { from: rect.x + rect.w,      offset: -rect.w      },  // 오른쪽 가장자리
    ];
    var checkY = [
      { from: rect.y,               offset: 0            },  // 위쪽 가장자리
      { from: rect.y + rect.h / 2,  offset: -rect.h / 2  },  // 수직 중심
      { from: rect.y + rect.h,      offset: -rect.h      },  // 아래쪽 가장자리
    ];

    guides.forEach(function (guide) {
      if (guide.axis === 'x') {
        checkX.forEach(function (cp) {
          if (Math.abs(cp.from - guide.value) <= threshX) {
            snappedX = guide.value + cp.offset;
          }
        });
      } else {
        checkY.forEach(function (cp) {
          if (Math.abs(cp.from - guide.value) <= threshY) {
            snappedY = guide.value + cp.offset;
          }
        });
      }
    });

    return Object.assign({}, rect, { x: snappedX, y: snappedY });
  }

  // ─────────────────────────────────────────────────────────────────
  // 1.3  자동 그리드 배치 (Auto Grid Layout)
  // ─────────────────────────────────────────────────────────────────

  /**
   * 객체들을 열(column) 단위로 자동 줄바꿈하여 격자 형태로 배치합니다.
   * 객체 크기는 유지하고 위치만 변경합니다.
   *
   * 셀 크기: 컨테이너 너비 / 열 수 (패딩 포함)
   * 행 높이: 각 행에서 가장 높은 객체 기준
   * 각 셀 내에서 객체는 가로·세로 중앙 정렬됩니다.
   *
   * @param {Array}  objects         배치할 객체 목록
   * @param {number} containerWidth  사용 가능한 너비 (정규화 좌표, 예: 1.0)
   * @param {number} columnCount     열 개수
   * @param {Object} [options]
   * @param {number} [options.paddingX=0.01]  열 사이 수평 간격 (정규화)
   * @param {number} [options.paddingY=0.01]  행 사이 수직 간격 (정규화)
   * @param {number} [options.originX=0]      그리드 시작 x (정규화)
   * @param {number} [options.originY=0]      그리드 시작 y (정규화)
   * @returns {Array}
   */
  function auto_grid_layout(objects, containerWidth, columnCount, options) {
    if (!objects || objects.length === 0) return [];

    var opts     = options || {};
    var paddingX = opts.paddingX !== undefined ? opts.paddingX : 0.01;
    var paddingY = opts.paddingY !== undefined ? opts.paddingY : 0.01;
    var originX  = opts.originX  !== undefined ? opts.originX  : 0;
    var originY  = opts.originY  !== undefined ? opts.originY  : 0;

    var cols  = Math.max(1, Math.floor(columnCount));
    // 열 사이 간격(cols-1 개)을 제외한 나머지를 열 수로 나눕니다
    var cellW = (containerWidth - paddingX * (cols - 1)) / cols;

    // 행별로 객체를 묶어서 행 높이를 계산합니다
    var rows = [];
    for (var i = 0; i < objects.length; i += cols) {
      rows.push(objects.slice(i, i + cols));
    }

    var result = [];
    var cursorY = originY;

    rows.forEach(function (row) {
      // 이 행에서 가장 높은 객체로 행 높이 결정
      var rowH = Math.max.apply(null, row.map(function (o) { return o.rect.h; }));

      row.forEach(function (obj, colIdx) {
        var cellLeft = originX + colIdx * (cellW + paddingX);

        // 셀 내 가로 중앙 정렬
        var objX = cellLeft + (cellW - obj.rect.w) / 2;
        // 셀 내 세로 중앙 정렬
        var objY = cursorY + (rowH - obj.rect.h) / 2;

        result.push(_clone(obj, Object.assign({}, obj.rect, { x: objX, y: objY })));
      });

      cursorY += rowH + paddingY;
    });

    return result;
  }

  // ─────────────────────────────────────────────────────────────────
  // 공개 API
  // ─────────────────────────────────────────────────────────────────

  global.AlignmentUtils = {
    SNAP_DISTANCE_PX: SNAP_DISTANCE_PX,

    // 정렬
    align_left:              align_left,
    align_center_horizontal: align_center_horizontal,
    align_right:             align_right,
    align_top:               align_top,
    align_middle_vertical:   align_middle_vertical,
    align_bottom:            align_bottom,

    // 균등 배치
    distribute_horizontal:   distribute_horizontal,
    distribute_vertical:     distribute_vertical,

    // 스냅
    computeGuides:           computeGuides,
    snap_to_guides:          snap_to_guides,

    // 그리드
    auto_grid_layout:        auto_grid_layout,

    // 테스트에서 사용 가능한 내부 헬퍼
    getBounds:               getBounds,
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
