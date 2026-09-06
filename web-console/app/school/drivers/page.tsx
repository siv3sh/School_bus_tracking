"use client";

import { SchoolPeoplePage } from "@/components/shared/school-people-page";

export default function DriversPage() {
  return (
    <SchoolPeoplePage
      title="Drivers"
      description="Invite drivers and manage their status."
      role="driver"
      emptyTitle="No drivers yet"
      emptyDescription="Invite your first driver. They’ll set a password from the invite link."
    />
  );
}
