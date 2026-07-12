import { describe, expect, it } from "vitest";
import {
  MAX_SIDEBAR_RATIO,
  MAX_SIDEBAR_WIDTH,
  MIN_CONTENT_WIDTH,
  MIN_SIDEBAR_WIDTH,
  sidebarWidthForPointer,
} from "./sidebar-width";

describe("sidebarWidthForPointer: ドラッグ中のポインタ位置からサイドバー幅を求める", () => {
  it("ポインタ位置がそのまま幅になる(workspaceLeft からの相対値)", () => {
    expect(sidebarWidthForPointer(300, 0, 1000)).toBe(300);
    expect(sidebarWidthForPointer(340, 40, 1000)).toBe(300);
  });

  it("MIN_SIDEBAR_WIDTH 未満は150にクランプする(左へ引き切っても消えない)", () => {
    expect(sidebarWidthForPointer(50, 0, 1000)).toBe(MIN_SIDEBAR_WIDTH);
    expect(sidebarWidthForPointer(-100, 0, 1000)).toBe(MIN_SIDEBAR_WIDTH);
  });

  it("MAX_SIDEBAR_WIDTH 超は500にクランプする(ウィンドウ幅の40%が500を下回るとき)", () => {
    // workspaceWidth=1000 のとき 40% = 400 < 500 なので上限は 500
    expect(sidebarWidthForPointer(900, 0, 1000)).toBe(MAX_SIDEBAR_WIDTH);
  });

  it("広いウィンドウでは幅の40%まで広げられる(500と40%の大きい方が上限)", () => {
    // workspaceWidth=2000 のとき 40% = 800 > 500 なので上限は 800
    expect(sidebarWidthForPointer(1500, 0, 2000)).toBe(2000 * MAX_SIDEBAR_RATIO);
    // 上限未満のポインタ位置はそのまま
    expect(sidebarWidthForPointer(700, 0, 2000)).toBe(700);
  });

  it("ウィンドウが狭いときは workspaceWidth - MIN_CONTENT_WIDTH が上限になる(エディタ/プレビュー側を潰さない)", () => {
    // workspaceWidth=600 のとき動的上限は 600 - 200 = 400(500より小さい)
    expect(sidebarWidthForPointer(550, 0, 600)).toBe(600 - MIN_CONTENT_WIDTH);
  });

  it("動的上限が MIN_SIDEBAR_WIDTH を下回るほど極端に狭い場合は MIN_SIDEBAR_WIDTH を返す(min優先・負値や0にならない)", () => {
    // workspaceWidth=300 のとき動的上限は 300 - 200 = 100 だが MIN_SIDEBAR_WIDTH(150) を下回れない
    expect(sidebarWidthForPointer(250, 0, 300)).toBe(MIN_SIDEBAR_WIDTH);
    expect(sidebarWidthForPointer(0, 0, 300)).toBe(MIN_SIDEBAR_WIDTH);
  });
});
