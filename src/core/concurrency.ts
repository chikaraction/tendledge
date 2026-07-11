// 同時実行数を制限した並列処理ヘルパー(純粋ロジック。DOM / fetch には依存しない)。
//
// 用途: Kroki 図の並列 fetch(ui/kroki.ts, limit=3)。サーバーへの同時リクエスト数を
// 抑えつつ、直列 for-await よりも速く全件を処理する。

/**
 * items を limit 件まで同時に fn へ渡して処理する。1件完了するたびに次を開始し、
 * 個々の fn が reject しても他の処理は継続する(全体は reject しない)。
 * 戻り値は items と同じ順序の PromiseSettledResult 配列。
 */
export async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        const value = await fn(items[index], index);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.min(Math.max(limit, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
