"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>Please reload the page.</p>
        <button onClick={reset} style={{ padding: "10px 16px", marginTop: 16 }}>Try again</button>
      </body>
    </html>
  );
}
