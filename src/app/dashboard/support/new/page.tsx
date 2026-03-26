import { TicketForm } from "@/components/support/ticket-form";

export default function NewTicketPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">New Ticket</h2>
      <p className="text-muted-foreground mb-6">
        Submit a bug report or feature request.
      </p>
      <TicketForm />
    </div>
  );
}
