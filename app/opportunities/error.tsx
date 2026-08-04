"use client";

export default function OpportunitiesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="shell">
      <section className="card stack">
        <div className="eyebrow">Opportunity Intelligence</div>
        <h1>The source workspace could not finish loading</h1>
        <p className="muted">No source run or CRM promotion should be assumed complete. Review the run status before retrying.</p>
        <button className="button primary" type="button" onClick={() => reset()}>Retry safely</button>
      </section>
    </main>
  );
}
