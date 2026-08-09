export type ConnectionStatus = {
  deviceOnline: boolean;
  brokerConnected: boolean;
  serverConnected: boolean;
};

type StatusItem = {
  label: string;
  connected: boolean;
  disconnectedLabel: string;
};

function statusItems(status: ConnectionStatus): StatusItem[] {
  return [
    { label: "Controller", connected: status.deviceOnline, disconnectedLabel: "Controller offline" },
    { label: "MQTT", connected: status.brokerConnected, disconnectedLabel: "MQTT disconnected" },
    { label: "API", connected: status.serverConnected, disconnectedLabel: "API disconnected" },
  ];
}

export function HeaderStatus({ status }: { status: ConnectionStatus }) {
  return <div className="header-status header-status-strip" aria-label="Connection status">
    {statusItems(status).map((item) => {
      const state = item.connected ? "connected" : "disconnected";
      const description = item.connected ? `${item.label}: connected` : item.disconnectedLabel;
      return <div className="header-status-strip-item" key={item.label} title={description}>
        <span className={`header-status-mark header-status-mark-${state}`} aria-label={description}/>
        <span className="header-status-label">{item.label}</span>
      </div>;
    })}
  </div>;
}
