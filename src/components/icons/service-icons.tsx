/**
 * Composant central d'icônes de services et catégories de pressing.
 * Basé sur Lucide / Tabler Icons (Licence MIT).
 */

import React from 'react';
import {
  Shirt,
  BedDouble,
  Footprints,
  Sparkles,
  Scissors,
  Crown,
  ShieldCheck,
  Briefcase,
  Layers,
  ShoppingBag,
  Clock,
  Truck,
  Phone,
  MessageCircle,
  MapPin,
  CalendarCheck,
} from 'lucide-react';
import { IronIcon } from './IronIcon';
import { SuitIcon } from './SuitIcon';

interface IconProps {
  className?: string;
}

/**
 * Cintre (Hanger) SVG Tabler/Lucide
 */
export function HangerIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 6a3 3 0 0 1 3 3c0 .8-.3 1.5-1 2l-8.5 5.5a2 2 0 0 0-1 1.7V19h17v-.8a2 2 0 0 0-1-1.7L13 11a3 3 0 0 1-1-2" />
    </svg>
  );
}

/**
 * Veste / Blouson SVG
 */
export function JacketIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 3h12l3 6v12H3V9l3-6z" />
      <path d="M6 3v6l6 3 6-3V3" />
      <path d="M12 12v9" />
    </svg>
  );
}

/**
 * Moto de livraison SVG
 */
export function MotorbikeIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="5" cy="16" r="3" />
      <circle cx="19" cy="16" r="3" />
      <path d="M7.5 14h5l3-6h3" />
      <path d="M10 9h3" />
      <path d="M14 16h-4" />
    </svg>
  );
}

/**
 * Cravate (Tie) SVG
 */
export function TieIcon({ className = 'w-6 h-6' }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 2h4l1 3-3 2-3-2 1-3z" />
      <path d="m11 7 1 12 2 3 2-3 1-12" />
    </svg>
  );
}

/**
 * Fonction centrale de sélection d'icône par nom de catégorie ou de service.
 */
export function pickServiceIcon(categoryName?: string | null, className = 'w-6 h-6'): React.ReactElement {
  if (!categoryName) return <Shirt className={className} />;

  const norm = categoryName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // 1. Costumes & Cérémonie
  if (
    norm.includes('costume') ||
    norm.includes('ceremonie') ||
    norm.includes('soiree') ||
    norm.includes('smoking') ||
    norm.includes('veste')
  ) {
    return <SuitIcon className={className} />;
  }

  // 2. Tenues Traditionnelles (Bazin, Pagne, Boubou)
  if (
    norm.includes('tradition') ||
    norm.includes('bazin') ||
    norm.includes('pagne') ||
    norm.includes('boubou') ||
    norm.includes('abacost')
  ) {
    return <Crown className={className} />;
  }

  // 3. Chaussures & Baskets
  if (
    norm.includes('chaussur') ||
    norm.includes('basket') ||
    norm.includes('soulie') ||
    norm.includes('botte') ||
    norm.includes('mocassin')
  ) {
    return <Footprints className={className} />;
  }

  // 4. Cuir & Daim
  if (norm.includes('cuir') || norm.includes('daim') || norm.includes('blouson')) {
    return <JacketIcon className={className} />;
  }

  // 5. Linge de maison
  if (
    norm.includes('maison') ||
    norm.includes('linge') ||
    norm.includes('drap') ||
    norm.includes('couette') ||
    norm.includes('oreiller') ||
    norm.includes('serviette') ||
    norm.includes('rideau')
  ) {
    return <BedDouble className={className} />;
  }

  // 6. Retouches & Couture
  if (
    norm.includes('retouche') ||
    norm.includes('couture') ||
    norm.includes('ourlet') ||
    norm.includes('fermeture') ||
    norm.includes('reparation')
  ) {
    return <Scissors className={className} />;
  }

  // 7. Repassage seul
  if (norm.includes('repass') || norm.includes('fer')) {
    return <IronIcon className={className} />;
  }

  // 8. Accessoires & Sacs
  if (
    norm.includes('accessoir') ||
    norm.includes('sac') ||
    norm.includes('cravate') ||
    norm.includes('chapeau') ||
    norm.includes('ceinture')
  ) {
    return <TieIcon className={className} />;
  }

  // 9. Sous-vêtements et nuit
  if (
    norm.includes('sous-vetement') ||
    norm.includes('nuit') ||
    norm.includes('pyjama') ||
    norm.includes('lingerie')
  ) {
    return <Sparkles className={className} />;
  }

  // 10. Professionnel et uniformes
  if (
    norm.includes('professionnel') ||
    norm.includes('uniforme') ||
    norm.includes('travail') ||
    norm.includes('blouse')
  ) {
    return <Briefcase className={className} />;
  }

  // 11. Vêtements du quotidien (Chemise, Pantalon, T-shirt, Jupe, etc.)
  if (
    norm.includes('vetement') ||
    norm.includes('chemis') ||
    norm.includes('pantalon') ||
    norm.includes('t-shirt') ||
    norm.includes('jupe') ||
    norm.includes('robe')
  ) {
    return <Shirt className={className} />;
  }

  // 12. Autres / Défaut
  return <HangerIcon className={className} />;
}
