/**
 * /api/company/org
 *
 * GET: Get org chart data (departments + user profiles)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { db } from "@/db";
import { departments, userProfiles, users } from "@/db/schema";
import { eq, and, asc, isNull } from "drizzle-orm";

interface OrgUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  jobTitle: string | null;
  departmentId: string | null;
  managerId: string | null;
  location: string | null;
  phone: string | null;
  isOrgChartVisible: boolean;
  directReports: OrgUser[];
}

interface OrgDepartment {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  parentDepartmentId: string | null;
  members: OrgUser[];
  children: OrgDepartment[];
}

/**
 * GET /api/company/org
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    // Fetch all departments
    const deptList = await db
      .select()
      .from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.isActive, true)))
      .orderBy(asc(departments.name));

    // Fetch all user profiles with user details
    const profileList = await db
      .select({
        profileId: userProfiles.id,
        userId: userProfiles.userId,
        departmentId: userProfiles.departmentId,
        jobTitle: userProfiles.jobTitle,
        managerUserId: userProfiles.managerUserId,
        location: userProfiles.location,
        phone: userProfiles.phone,
        isOrgChartVisible: userProfiles.isOrgChartVisible,
        userName: users.fullName,
        userEmail: users.email,
      })
      .from(userProfiles)
      .innerJoin(users, eq(userProfiles.userId, users.id))
      .where(eq(userProfiles.tenantId, tenantId));

    // Build user map by userId
    const userMap = new Map<string, OrgUser>();
    profileList.forEach((p) => {
      userMap.set(p.userId, {
        id: p.profileId,
        userId: p.userId,
        name: p.userName || p.userEmail || "Unknown",
        email: p.userEmail || "",
        jobTitle: p.jobTitle,
        departmentId: p.departmentId,
        managerId: p.managerUserId,
        location: p.location,
        phone: p.phone,
        isOrgChartVisible: p.isOrgChartVisible,
        directReports: [],
      });
    });

    // Build reporting structure
    userMap.forEach((user) => {
      if (user.managerId && userMap.has(user.managerId)) {
        userMap.get(user.managerId)!.directReports.push(user);
      }
    });

    // Build department tree
    const deptMap = new Map<string, OrgDepartment>();
    deptList.forEach((d) => {
      deptMap.set(d.id, {
        id: d.id,
        name: d.name,
        code: d.code,
        description: d.description,
        parentDepartmentId: d.parentDepartmentId,
        members: [],
        children: [],
      });
    });

    // Assign users to departments
    profileList.forEach((p) => {
      if (p.departmentId && deptMap.has(p.departmentId)) {
        const user = userMap.get(p.userId);
        if (user && user.isOrgChartVisible) {
          deptMap.get(p.departmentId)!.members.push(user);
        }
      }
    });

    // Build department hierarchy
    deptList.forEach((d) => {
      if (d.parentDepartmentId && deptMap.has(d.parentDepartmentId)) {
        deptMap.get(d.parentDepartmentId)!.children.push(deptMap.get(d.id)!);
      }
    });

    // Get root departments (no parent)
    const rootDepartments = Array.from(deptMap.values()).filter((d) => !d.parentDepartmentId);

    // Get users without department (unassigned)
    const unassignedUsers = Array.from(userMap.values()).filter(
      (u) => !u.departmentId && u.isOrgChartVisible
    );

    // Get top-level managers (no manager, visible in org chart)
    const topManagers = Array.from(userMap.values()).filter(
      (u) => !u.managerId && u.isOrgChartVisible
    );

    return NextResponse.json({
      departments: rootDepartments,
      unassignedUsers,
      topManagers,
      stats: {
        totalDepartments: deptList.length,
        totalUsers: profileList.length,
        visibleUsers: profileList.filter((p) => p.isOrgChartVisible).length,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/company/org error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
