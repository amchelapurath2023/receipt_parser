import { useEffect, useRef } from "react";

export function useCollaborativeReceipt(sessionId, items, setItems) {
  const wsRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;
    const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => console.log("Connected to collaboration session:", sessionId);
    ws.onclose = () => console.log("Disconnected");
    ws.onerror = (e) => console.error("WebSocket error", e);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log("Incoming:", msg);

      switch (msg.type) {
        case "update_item":
            setItems((prev) => {
              const updated = prev.map((it) =>
                it.id === msg.item.id ? { ...it, ...msg.item } : it
              );
              return [...updated]; // clone to force DataTable re-render
            });
            break;
          
        case "add_item":
            setItems((prev) => [...prev, { ...msg.item }]);
            break;
          
        case "delete_item":
            setItems((prev) => [...prev.filter((it) => it.id !== msg.id)]);
            break;
          
        case "init_receipt":
            setItems([...msg.items]); // clone the array too
            break;
          
        default:
          break;
      }
    };

    return () => ws.close();
  }, [sessionId, setItems]);

  const broadcast = (msg) => {
    console.log("sending", msg);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  return { broadcast };
}
