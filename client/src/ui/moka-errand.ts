import type { Command, PendingCommand, PlaySnapshot } from "../core/play";
import type { CommandResult } from "../net/plays";

export async function confirmedCommand(snapshot: PlaySnapshot, command: Command, send: (playId: string, pending: PendingCommand) => Promise<CommandResult>, apply: (result: CommandResult) => void): Promise<void> {
  const pending = { key: crypto.randomUUID(), expectedRevision: snapshot.revision, command };
  apply(await send(snapshot.playId, pending));
}
