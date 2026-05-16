export function ErrorState({ message }: { message: string }) {
  return <div className="state error">{message}</div>;
}
