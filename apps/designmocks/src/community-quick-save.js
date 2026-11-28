// One-tap Save for student posts. The backend keeps saves in folders; students never see
// them: everything goes into one folder named "Saved", created on first use.
import { communityFolderName, validateCommunityFolder, validateCommunityFolders, validateCommunitySaves } from "./community-library.js";

export const QUICK_SAVE_FOLDER = "Saved";

export async function quickSaveFolder(rpc, signal) {
  const folders = validateCommunityFolders(await rpc("community_folders", {}, signal));
  const existing = folders.find(folder => folder.name.toLowerCase() === QUICK_SAVE_FOLDER.toLowerCase()) ?? folders[0];
  if (existing) return existing.id;
  return validateCommunityFolder(await rpc("save_community_folder", { p_folder_id: null, p_name: communityFolderName(QUICK_SAVE_FOLDER) }, signal)).id;
}

// Saved → not saved removes the post from every folder; not saved → saved puts it in "Saved".
export async function toggleQuickSave(rpc, postId, saved, signal) {
  const folderIds = saved ? [] : [await quickSaveFolder(rpc, signal)];
  return validateCommunitySaves(await rpc("set_community_saves", { p_post_id: postId, p_folder_ids: folderIds }, signal), postId);
}
