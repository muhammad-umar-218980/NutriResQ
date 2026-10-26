
import { useEffect, useState } from "react";

type ApiHealth = {
  success: boolean;
  message: string;
  timestamp: string;
};

function App() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkApi() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;

        const response = await fetch(`${apiUrl}/api/health`);

        if (!response.ok) {
          throw new Error(`API returned HTTP ${response.status}`);
        }

        const data: ApiHealth = await response.json();
        setHealth(data);
      } catch {
        setError("Could not connect to the NutriResQ backend.");
      } finally {
        setLoading(false);
      }
    }

    void checkApi();
  }, []);

  return (
    <main>
      <h1>NutriResQ</h1>
      <p>Smart Food Rescue &amp; Redistribution Optimizer</p>

      <section>
        <h2>System Status</h2>

        {loading && <p>Checking backend connection...</p>}

        {health && (
          <div>
            <p>API: Connected</p>
            <p>{health.message}</p>
            <p>Checked at: {health.timestamp}</p>
          </div>
        )}

        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}

export default App;
