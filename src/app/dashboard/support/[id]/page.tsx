"use client";

import { use } from "react";
import { TicketDetail } from "@/components/support/ticket-detail";

export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TicketDetail ticketId={id} />;
}
