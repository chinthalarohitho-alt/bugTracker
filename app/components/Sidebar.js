"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Bug, Folder, BarChart3, Users, Settings, User, Palette, Building2, Lightbulb, ClipboardList, FlaskConical
} from "lucide-react";
import { useAuth } from "./AuthProvider";

const PRIMARY_LINKS = [
  { href: "/",          label: "Home",      icon: Home },
  { href: "/bugs",      label: "Bugs",      icon: Bug },
  { href: "/projects",  label: "Projects",  icon: Folder },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/team",      label: "Team",      icon: Users },
];

const DESIGNER_LINK = { href: "/design-hub", label: "Design Hub", icon: Palette };
const SALES_LINK = { href: "/sales-hub", label: "Sales Hub", icon: Building2 };
const FOUNDER_LINK = { href: "/founder-hub", label: "Founder Hub", icon: Lightbulb };
const PM_LINK = { href: "/pm-hub", label: "PM Hub", icon: ClipboardList };
const QA_LINK = { href: "/qa-hub", label: "QA Hub", icon: FlaskConical };

const SECONDARY_LINKS = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/profile",  label: "Profile",  icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { currentReporter, userRole } = useAuth();
  const isActive = (href) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (!currentReporter) return null;

  const roleLinkMap = {
    'Designer': DESIGNER_LINK,
    'Sales Manager': SALES_LINK,
    'Founder': FOUNDER_LINK,
    'Project Manager': PM_LINK,
    'QA Engineer': QA_LINK,
  };
  const roleLink = roleLinkMap[userRole];
  const links = roleLink
    ? [PRIMARY_LINKS[0], roleLink, ...PRIMARY_LINKS.slice(1)]
    : PRIMARY_LINKS;

  return (
    <aside className="sidenav">
      <Link href="/" className="sidenav-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tapzaLogo.png" alt="Tapza" />
        <span className="sidenav-brand-text">
          <span className="sidenav-brand-name">TAPZA</span>
          <span className="sidenav-brand-sub">Internal Portal</span>
        </span>
      </Link>

      <div className="sidenav-section">Workspace</div>
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`sidenav-link ${isActive(href) ? "active" : ""}`}
        >
          <Icon size={17} strokeWidth={1.8} />
          <span>{label}</span>
        </Link>
      ))}

      <div className="sidenav-footer">
        {SECONDARY_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidenav-link ${isActive(href) ? "active" : ""}`}
          >
            <Icon size={17} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
