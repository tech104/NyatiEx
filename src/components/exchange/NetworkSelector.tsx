import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SUPPORTED_NETWORKS, type NetworkId } from "@/types/exchange";
import { Globe } from "lucide-react";

interface NetworkSelectorProps {
  value: NetworkId;
  onChange: (network: NetworkId) => void;
  enabledNetworks?: NetworkId[];
}

export function NetworkSelector({ value, onChange, enabledNetworks }: NetworkSelectorProps) {
  const selected = SUPPORTED_NETWORKS.find((n) => n.id === value);
  const networks = enabledNetworks
    ? SUPPORTED_NETWORKS.filter((n) => enabledNetworks.includes(n.id))
    : SUPPORTED_NETWORKS;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm">
        <Globe className="w-4 h-4 text-muted-foreground" />
        Blockchain Network
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as NetworkId)}>
        <SelectTrigger className="h-12 bg-muted/30">
          <SelectValue>
            {selected && (
              <span className="flex items-center gap-2">
                <img src={selected.logo} alt={selected.name} className="w-5 h-5 rounded-full" />
                <span>{selected.name}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {networks.map((net) => (
            <SelectItem key={net.id} value={net.id}>
              <span className="flex items-center gap-2">
                <img src={net.logo} alt={net.name} className="w-5 h-5 rounded-full" />
                <span>{net.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
