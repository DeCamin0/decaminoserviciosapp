import {
  Brush,
  Shield,
  Settings2,
  Package,
  ClipboardList,
  FileText,
  Wrench,
} from 'lucide-react';

export function InspectionTypeIcon({ type, className = 'w-4 h-4', ...props }) {
  const Icon =
    type === 'limpieza' ? Brush
    : type === 'servicios' ? Shield
    : type === 'entrega-materiales' ? Package
    : type === 'personalizada' ? Settings2
    : type === 'solicitudes' ? ClipboardList
    : type === 'pdf-generator' ? FileText
    : Wrench;

  return <Icon className={className} aria-hidden {...props} />;
}
