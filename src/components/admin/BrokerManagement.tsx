import { useEffect, useState } from 'react';
import * as adminService from '../../services/adminService';
import type { AdminBroker, AdminOmsEndpoint } from '../../types/auth';

const TH = ({ children }: { children: React.ReactNode }) => (
  <th className="table-th">
    {children}
  </th>
);

const TD = ({ children, className = '', colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={`table-td ${className}`}>{children}</td>
);

export default function BrokerManagement() {
  const [brokers, setBrokers] = useState<AdminBroker[]>([]);
  const [omsEndpoints, setOmsEndpoints] = useState<AdminOmsEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newBrokerId, setNewBrokerId] = useState('');
  const [newBrokerLabel, setNewBrokerLabel] = useState('');
  const [newExternalApiId, setNewExternalApiId] = useState('');
  const [newApiEndpoint, setNewApiEndpoint] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editExternalApiId, setEditExternalApiId] = useState('');
  const [editApiEndpoint, setEditApiEndpoint] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [brokerList, endpointList] = await Promise.all([
        adminService.listBrokers(),
        adminService.listOmsEndpoints(),
      ]);
      setBrokers(brokerList);
      setOmsEndpoints(endpointList);
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
      const externalApiId = newExternalApiId.trim() || null;
      const apiEndpoint = newApiEndpoint || null;
      await adminService.createBroker({ brokerId, brokerLabel, externalApiId, apiEndpoint });
      setNewBrokerId('');
      setNewBrokerLabel('');
      setNewExternalApiId('');
      setNewApiEndpoint('');
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
    setEditExternalApiId(broker.externalApiId ?? '');
    setEditApiEndpoint(broker.apiEndpoint ?? '');
  }

  async function saveEdit(brokerId: string) {
    setError(null);
    try {
      const externalApiId = editExternalApiId.trim() || null;
      const apiEndpoint = editApiEndpoint || null;
      await adminService.updateBroker(brokerId, { brokerLabel: editLabel.trim(), externalApiId, apiEndpoint });
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
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Brokers</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Manage the brokers available for user assignment.</p>
      </div>

      {error && (
        <div className="alert-error">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="panel flex flex-wrap items-end gap-4 px-6 py-4">
        <div className="flex flex-col gap-1">
          <label className="field-label">Broker ID</label>
          <input
            type="text"
            required
            maxLength={10}
            value={newBrokerId}
            onChange={e => setNewBrokerId(e.target.value)}
            placeholder="e.g. SNM"
            className="field w-32 uppercase"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="field-label">Broker Label</label>
          <input
            type="text"
            required
            maxLength={100}
            value={newBrokerLabel}
            onChange={e => setNewBrokerLabel(e.target.value)}
            placeholder="e.g. SNM Securities"
            className="field w-64"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="field-label">External API ID</label>
          <input
            type="text"
            maxLength={32}
            value={newExternalApiId}
            onChange={e => setNewExternalApiId(e.target.value)}
            placeholder="e.g. 681caf09c0024a529d5a0fe4"
            className="field w-64"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="field-label">API Endpoint</label>
          <select
            value={newApiEndpoint}
            onChange={e => setNewApiEndpoint(e.target.value)}
            className="field w-40"
          >
            <option value="">— default (primary) —</option>
            {omsEndpoints.map(endpoint => (
              <option key={endpoint.name} value={endpoint.name}>{endpoint.name}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={creating}
          className="button-primary"
        >
          {creating ? 'Adding…' : 'Add Broker'}
        </button>
      </form>

      <div className="table-wrap">
        <table className="w-full text-left">
          <thead className="table-head">
            <tr>
              <TH>Broker ID</TH>
              <TH>Label</TH>
              <TH>External API ID</TH>
              <TH>API Endpoint</TH>
              <TH>Updated</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody className="table-body">
            {loading && (
              <tr><TD className="text-[var(--color-text-muted)]" colSpan={6}>Loading…</TD></tr>
            )}
            {!loading && brokers.length === 0 && (
              <tr><TD className="text-[var(--color-text-muted)]" colSpan={6}>No brokers yet.</TD></tr>
            )}
            {!loading && brokers.map(broker => (
              <tr key={broker.brokerId} className="table-row">
                <TD className="font-medium">{broker.brokerId}</TD>
                <TD>
                  {editingId === broker.brokerId ? (
                    <input
                      type="text"
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className="field-compact w-64"
                    />
                  ) : (
                    broker.brokerLabel
                  )}
                </TD>
                <TD>
                  {editingId === broker.brokerId ? (
                    <input
                      type="text"
                      maxLength={32}
                      value={editExternalApiId}
                      onChange={e => setEditExternalApiId(e.target.value)}
                      className="field-compact w-64"
                    />
                  ) : (
                    broker.externalApiId ?? <span className="text-[var(--color-text-muted)]">—</span>
                  )}
                </TD>
                <TD>
                  {editingId === broker.brokerId ? (
                    <select
                      value={editApiEndpoint}
                      onChange={e => setEditApiEndpoint(e.target.value)}
                      className="field-compact w-36"
                    >
                      <option value="">— default (primary) —</option>
                      {omsEndpoints.map(endpoint => (
                        <option key={endpoint.name} value={endpoint.name}>{endpoint.name}</option>
                      ))}
                    </select>
                  ) : (
                    broker.apiEndpoint ?? <span className="text-[var(--color-text-muted)]">primary</span>
                  )}
                </TD>
                <TD>{new Date(broker.updatedAt).toLocaleString()}</TD>
                <TD>
                  {editingId === broker.brokerId ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(broker.brokerId)}
                        className="button-success"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="button-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(broker)}
                        className="button-muted"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(broker.brokerId)}
                        className="button-danger"
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
