### Broker Snapshot Access Control (role: user)

# User with broker_id assigned → can view only broker_snapshots filtered by their assigned broker_id
# User with broker_id = NULL → can view broker_snapshots for all brokers

# Backend logic (/api/internal/broker-data or equivalent):
    pythonif current_user.broker_id is not None:
        query = query.filter(broker_snapshots.broker_id == current_user.broker_id)
# else: no filter, return all
admin role → unaffected (full access regardless of broker_id, if applicable).