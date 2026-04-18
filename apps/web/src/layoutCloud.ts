import { applyWorkspaceLayoutBundle, createWorkspaceLayoutBundle, normalizeWorkspaceLayoutBundle } from "./pageLayoutBundle";
import { getSupabaseClient, hasSupabaseConfig } from "./lib/supabase";

function normalizeBundleName(name: string) {
  return name.trim() || "workspace-layout";
}

async function requireAuthenticatedUserId() {
  if (!hasSupabaseConfig) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("Sign in to use cloud layouts.");
  }

  return { supabase, userId: user.id };
}

export async function saveLayoutBundleToSupabase(name: string) {
  const { supabase, userId } = await requireAuthenticatedUserId();
  const bundle = createWorkspaceLayoutBundle(name);

  const { error } = await supabase
    .from("user_layout_bundles")
    .upsert(
      {
        user_id: userId,
        bundle_name: normalizeBundleName(bundle.name),
        payload: bundle
      },
      {
        onConflict: "user_id,bundle_name"
      }
    );

  if (error) {
    throw error;
  }

  return {
    bundleName: bundle.name,
    savedAt: bundle.savedAt
  };
}

export async function loadLayoutBundleFromSupabase(name: string) {
  const { supabase, userId } = await requireAuthenticatedUserId();
  const normalizedName = normalizeBundleName(name);

  const { data, error } = await supabase
    .from("user_layout_bundles")
    .select("payload")
    .eq("user_id", userId)
    .eq("bundle_name", normalizedName)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.payload) {
    return null;
  }

  const bundle = normalizeWorkspaceLayoutBundle(data.payload);
  if (!bundle) {
    throw new Error("The saved cloud layout bundle is not valid.");
  }

  applyWorkspaceLayoutBundle(bundle);
  return bundle;
}
