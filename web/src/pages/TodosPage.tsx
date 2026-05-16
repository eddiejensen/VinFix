import { useEffect, useState } from "react";
import { PageTitle } from "../components/PageTitle";
import { SelectedVehicleCard } from "../components/SelectedVehicleCard";
import { useVehicle } from "../context/VehicleContext";
import { makeId, readLocalArray, STORAGE_KEYS, type TodoEntry, vehicleKey, writeLocalArray } from "../utils/localData";

export function TodosPage() {
  const { selectedVehicle } = useVehicle();
  const [todos, setTodos] = useState<TodoEntry[]>(() => readLocalArray(STORAGE_KEYS.todos));
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const activeKey = selectedVehicle ? vehicleKey(selectedVehicle) : "";

  useEffect(() => writeLocalArray(STORAGE_KEYS.todos, todos), [todos]);

  function addTodo() {
    if (!selectedVehicle || !title.trim()) return;
    setTodos((prev) => [{ id: makeId("todo"), vehicleKey: activeKey, title: title.trim(), notes, complete: false }, ...prev]);
    setTitle("");
    setNotes("");
  }

  const visibleTodos = todos.filter((todo) => !activeKey || todo.vehicleKey === activeKey);

  return <div className="page"><PageTitle title="To-Dos" /><div className="page-head"><span className="eyebrow">To-Dos</span><h1>Repair and maintenance tasks</h1><p>Keep a simple checklist for your selected vehicle.</p></div><SelectedVehicleCard vehicle={selectedVehicle} />{!selectedVehicle ? <div className="empty-card">Select a vehicle to add to-dos.</div> : <div className="card"><label>Task<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Inspect brakes, order fuel pump" /></label><label>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label><button className="primary" disabled={!title.trim()} onClick={addTodo}>Add to-do</button></div>}<div className="stack">{visibleTodos.length === 0 ? <div className="empty-card">No open to-dos yet.</div> : null}{visibleTodos.map((todo) => <article className="issue-card" key={todo.id}><span className={todo.complete ? "badge" : "badge orange"}>{todo.complete ? "Complete" : "Open"}</span><h3>{todo.title}</h3><p>{todo.notes || "No notes saved."}</p><div className="button-row wrap"><button className="primary" onClick={() => setTodos((prev) => prev.map((item) => item.id === todo.id ? { ...item, complete: !item.complete } : item))}>{todo.complete ? "Mark open" : "Mark complete"}</button><button className="secondary danger-soft" onClick={() => setTodos((prev) => prev.filter((item) => item.id !== todo.id))}>Delete</button></div></article>)}</div></div>;
}
