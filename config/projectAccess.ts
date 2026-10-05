import AsyncStorage from "@react-native-async-storage/async-storage";
import { ProjectRole } from "@/types/projects";

export const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: "Proje sahibi",
  manager: "Yönetici",
  office: "Ofis personeli",
  chief: "Şantiye şefi",
  field: "Şantiye şefi",
};

export const normalizeProjectRole = (
  role?: ProjectRole | string | null,
): ProjectRole => (role === "field" ? "chief" : (role as ProjectRole) || "owner");

export const canSeeCosts = (role?: ProjectRole | string) =>
  role === "owner" || role === "manager";

export const canManageTeam = canSeeCosts;
export const canUseMeasurements = (role?: ProjectRole | string) =>
  canSeeCosts(role) || role === "chief" || role === "field";
export const canUseDaily = (role?: ProjectRole | string) =>
  canSeeCosts(role) || role === "office" || role === "chief" || role === "field";
export const canCreateDaily = (role?: ProjectRole | string) =>
  canSeeCosts(role) || role === "chief" || role === "field";
export const canExportDaily = (role?: ProjectRole | string) =>
  canSeeCosts(role) || role === "office";
export const canUseDocuments = (role?: ProjectRole | string) =>
  canSeeCosts(role) || role === "office";
export const canManageDocuments = canSeeCosts;

export async function saveActiveProject(project: {
  id: string;
  ownerId: string;
  role: ProjectRole;
  name?: string;
}) {
  const normalizedRole = normalizeProjectRole(project.role);
  await AsyncStorage.multiSet([
    ["activeProjectId", project.id],
    ["activeProjectOwnerId", project.ownerId],
    ["activeProjectRole", normalizedRole],
    ["activeProjectName", project.name ?? ""],
  ]);
}

export async function loadActiveProject() {
  const values = await AsyncStorage.multiGet([
    "activeProjectId",
    "activeProjectOwnerId",
    "activeProjectRole",
    "activeProjectName",
  ]);
  const map = Object.fromEntries(values);
  return {
    id: map.activeProjectId ?? "",
    ownerId: map.activeProjectOwnerId ?? "",
    role: normalizeProjectRole(map.activeProjectRole),
    name: map.activeProjectName ?? "",
  };
}

export async function clearActiveProject() {
  await AsyncStorage.multiRemove([
    "activeProjectId",
    "activeProjectOwnerId",
    "activeProjectRole",
    "activeProjectName",
  ]);
}

export const projectAccessId = (ownerId: string, projectId: string) =>
  `${ownerId}_${projectId}`;
