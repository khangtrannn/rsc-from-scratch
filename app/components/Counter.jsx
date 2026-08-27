"use client";

import { useState } from "react";
import CounterButton from "./CounterButton.jsx";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <CounterButton
      count={count}
      onClick={() => setCount((count) => count + 1)}
    />
  );
}