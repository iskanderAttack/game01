/**
 * Кубики.
 *
 * Живут отдельным файлом, потому что их рисуют обе доски — и объёмная,
 * и плоская, — а ссылаться друг на друга им незачем.
 */

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Dice({ values, rolling }: { values: [number, number]; rolling?: boolean }) {
  return (
    <div className="dice-row">
      {values.map((v, i) => (
        <div key={i} className={`die ${rolling ? 'rolling' : ''}`}>
          {Array.from({ length: 9 }).map((_, cell) => (
            <span key={cell}>{PIPS[v]?.includes(cell) ? <i /> : null}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
