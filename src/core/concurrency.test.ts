import { describe, expect, it } from "vitest";
import { mapWithConcurrencyLimit } from "./concurrency";

/** 手動で resolve/reject を制御できる Promise(タイミングをテストで固定するため) */
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** マイクロタスクキューを掃き出す(setTimeout はマクロタスクなので後に実行される) */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mapWithConcurrencyLimit: 同時実行数を制限した並列実行", () => {
  it("件数が limit 未満なら全件が即座に開始される", async () => {
    const items = [1, 2];
    let startedCount = 0;
    const gate = deferred<void>();
    const resultPromise = mapWithConcurrencyLimit(items, 5, async (item) => {
      startedCount++;
      await gate.promise;
      return item;
    });
    await flushMicrotasks();
    expect(startedCount).toBe(2);
    gate.resolve();
    await resultPromise;
  });

  it("limit を超える分は先行完了を待ってから開始する", async () => {
    const items = [1, 2, 3];
    const limit = 2;
    const started: number[] = [];
    const gates = items.map(() => deferred<void>());
    const resultPromise = mapWithConcurrencyLimit(items, limit, async (item, index) => {
      started.push(item);
      await gates[index].promise;
      return item;
    });

    await flushMicrotasks();
    // limit=2 なので 1, 2 だけが開始され、3 はまだ開始されない
    expect(started).toEqual([1, 2]);

    gates[0].resolve();
    await flushMicrotasks();
    // 1 件目の完了を受けて 3 件目が開始される
    expect(started).toEqual([1, 2, 3]);

    gates[1].resolve();
    gates[2].resolve();
    await resultPromise;
  });

  it("同時実行数が limit を超えない", async () => {
    const limit = 3;
    const items = Array.from({ length: 8 }, (_, i) => i);
    let running = 0;
    let maxRunning = 0;
    await mapWithConcurrencyLimit(items, limit, async (item) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await flushMicrotasks();
      running--;
      return item;
    });
    expect(maxRunning).toBeLessThanOrEqual(limit);
  });

  it("途中で reject があっても他の処理は続行される", async () => {
    const items = [1, 2, 3];
    const results = await mapWithConcurrencyLimit(items, 3, async (item) => {
      if (item === 2) throw new Error("失敗");
      return item * 10;
    });
    expect(results[0]).toEqual({ status: "fulfilled", value: 10 });
    expect(results[1].status).toBe("rejected");
    expect(results[2]).toEqual({ status: "fulfilled", value: 30 });
  });

  it("全件完了すると、入力順に結果を並べて resolve する", async () => {
    const items = ["a", "b", "c", "d"];
    const results = await mapWithConcurrencyLimit(items, 2, async (item) => item.toUpperCase());
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : undefined))).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("items が空なら即座に空配列で resolve する", async () => {
    const results = await mapWithConcurrencyLimit([], 3, async (item: never) => item);
    expect(results).toEqual([]);
  });
});
