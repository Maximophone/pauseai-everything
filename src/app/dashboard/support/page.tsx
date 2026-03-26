import { TicketList } from "@/components/support/ticket-list";

export default function SupportPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Support</h2>
      <p className="text-muted-foreground mb-6">
        Report issues or request new features.
      </p>
      <TicketList />
    </div>
  );
}
