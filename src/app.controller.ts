import { Controller, Get, Header } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  @Header("Content-Type", "text/html")
  getDashboard(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resolve — Tickets Dashboard Test</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen p-8">
  <div class="max-w-6xl mx-auto space-y-8">
    <header class="flex justify-between items-center border-b border-slate-800 pb-6">
      <div>
        <h1 class="text-3xl font-bold text-white tracking-tight">Resolve Dashboard Test</h1>
        <p class="text-slate-400 text-sm mt-1">v0 Core Tickets Management System</p>
      </div>
      <div id="stats-box" class="flex gap-4">
        <div class="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 text-center">
          <div class="text-xs text-slate-400 uppercase font-semibold">Total Tickets</div>
          <div id="stat-total" class="text-xl font-bold text-indigo-400">0</div>
        </div>
      </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <section class="bg-slate-800 p-6 rounded-xl border border-slate-700 h-fit">
        <h2 class="text-xl font-semibold mb-4 text-white">New Ticket</h2>
        <form id="create-form" class="space-y-4">
          <div>
            <label class="block text-xs text-slate-400 mb-1">Subject</label>
            <input type="text" id="subject" required class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:outline-none focus:border-indigo-500">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Customer Email</label>
            <input type="email" id="customerEmail" required class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:outline-none focus:border-indigo-500">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Priority</label>
            <select id="priority" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:outline-none focus:border-indigo-500">
              <option value="low">Low</option>
              <option value="normal" selected>Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Description</label>
            <textarea id="description" rows="3" required class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:outline-none focus:border-indigo-500"></textarea>
          </div>
          <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded transition text-sm">
            Create Ticket
          </button>
        </form>
      </section>

      <section class="lg:col-span-2 space-y-4">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold text-white">Tickets</h2>
          <button onclick="loadData()" class="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded border border-slate-700 transition">
            Refresh
          </button>
        </div>
        <div id="tickets-list" class="space-y-3">
          <div class="text-slate-500 text-sm">Loading tickets...</div>
        </div>
      </section>
    </div>
  </div>

  <script>
    async function loadStats() {
      try {
        const res = await fetch('/stats');
        const data = await res.json();
        document.getElementById('stat-total').innerText = data.total || 0;
      } catch (e) {}
    }

    async function loadTickets() {
      try {
        const res = await fetch('/tickets');
        const tickets = await res.json();
        const listEl = document.getElementById('tickets-list');
        
        if (!tickets || tickets.length === 0) {
          listEl.innerHTML = '<div class="bg-slate-800/50 p-6 text-center text-slate-500 rounded-xl border border-slate-800">No tickets found.</div>';
          return;
        }

        listEl.innerHTML = tickets.map(t => \`
          <div class="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-2">
            <div class="flex justify-between items-start">
              <h3 class="font-semibold text-white">\${t.subject}</h3>
              <div class="flex gap-2">
                <span class="text-xs px-2 py-0.5 rounded font-mono uppercase bg-indigo-950 text-indigo-300 border border-indigo-800">\${t.priority}</span>
                <span class="text-xs px-2 py-0.5 rounded font-mono uppercase bg-slate-900 text-slate-300 border border-slate-700">\${t.status}</span>
              </div>
            </div>
            <p class="text-slate-300 text-sm">\${t.description}</p>
            <div class="text-xs text-slate-500 pt-2 border-t border-slate-700/50 flex justify-between">
              <span>Customer: \${t.customerEmail}</span>
              <span>ID: \${t.id}</span>
            </div>
          </div>
        \`).join('');
      } catch (e) {}
    }

    async function loadData() {
      await Promise.all([loadStats(), loadTickets()]);
    }

    document.getElementById('create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        subject: document.getElementById('subject').value,
        customerEmail: document.getElementById('customerEmail').value,
        priority: document.getElementById('priority').value,
        description: document.getElementById('description').value,
      };

      const res = await fetch('/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        document.getElementById('create-form').reset();
        loadData();
      } else {
        alert('Failed to create ticket');
      }
    });

    loadData();
  </script>
</body>
</html>
    `;
  }
}
