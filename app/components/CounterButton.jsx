export default function CounterButton({
  count,
  onClick,
}) {
  return (
    <button onClick={onClick}>
      Count: {count}
    </button>
  );
}