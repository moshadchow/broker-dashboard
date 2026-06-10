import { useEffect, useState } from 'react';
import * as adminService from '../../services/adminService';
import type { AdminBroker } from '../../types/auth';

const TH = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
    {children}
  </th>
);

const TD = ({ children, className = '', colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={`px-4 py-3 text-sm text-gray-700 whitespace-nowrap ${className}`}>{children}</td>
);

export default function BrokerManagement() {
  const [brokers, setBrokers] = useState<AdminBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newBrokerId, setNewBrokerId] = useState('');
  const [newBrokerLabel, setNewBrokerLabel] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setBrokers(await adminService.listBrokers());
    } catch {
      setError('Failed to load brokers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const brokerId = newBrokerId.trim().toUpperCase();
      const brokerLabel = newBrokerLabel.trim();
      await adminService.createBroker({ brokerId, brokerLabel });
      setNewBrokerId('');
      setNewBrokerLabel('');
      await load();
    } catch {
      setError('Failed to create broker. The broker ID may already exist.');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(broker: AdminBroker) {
    setEditingId(broker.brokerId);
    setEditLabel(broker.brokerLabel);
  }

  async function saveEdit(brokerId: string) {
    setError(null);
    try {
      await adminService.updateBroker(brokerId, { brokerLabel: editLabel.trim() });
      setEditingId(null);
      await load();
    } catch {
      setError('Failed to update broker.');
    }
  }

  async function handleDelete(brokerId: string) {
    setError(null);
    try {
      await adminService.deleteBroker(brokerId);
      await load();
    } catch {
      setError('Failed to delete broker. It may still be assigned to a user.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Brokers</h2>
        <p className="text-sm text-gray-500">Manage the brokers available for user assignment.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4 bg-white border border-gray-200 rounded-xl px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Broker ID</label>
          <input
            type="text"
            required
            maxLength={10}
            value={newBrokerId}
            onChange={e => setNewBrokerId(e.target.value)}
            placeholder="e.g. SNM"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Broker Label</label>
          <input
            type="text"
            required
            maxLength={100}
            value={newBrokerLabel}
            onChange={e => setNewBrokerLabel(e.target.value)}
            placeholder="e.g. SNM Securities"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={creating}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {creating ? 'Adding…' : 'Add Broker'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <TH>Broker ID</TH>
              <TH>Label</TH>
              <TH>Updated</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><TD className="text-gray-400" colSpan={4}>Loading…</TD></tr>
            )}
            {!loading && brokers.length === 0 && (
              <tr><TD className="text-gray-400" colSpan={4}>No brokers yet.</TD></tr>
            )}
            {!loading && brokers.map(broker => (
              <tr key={broker.brokerId} className="hover:bg-gray-50">
                <TD className="font-medium">{broker.brokerId}</TD>
                <TD>
                  {editingId === broker.brokerId ? (
                    <input
                      type="text"
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    broker.brokerLabel
                  )}
                </TD>
                <TD>{new Date(broker.updatedAt).toLocaleString()}</TD>
                <TD>
                  {editingId === broker.brokerId ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(broker.brokerId)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(broker)}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(broker.brokerId)}
                        className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-semibold transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
