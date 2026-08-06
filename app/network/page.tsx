import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import OpportunitiesPage from "@/app/opportunities/page";
import TargetsPage from "@/app/targets/page";

type SearchValue = string | string[] | undefined;
type NetworkSearchParams = Record<string, SearchValue>;
type NetworkView = "discover" | "saved" | "relationships";

type NetworkElementProps = {
  action?: unknown;
  children?: ReactNode;
  directoryItems?: unknown;
  href?: unknown;
  items?: unknown;
  method?: unknown;
};

function firstValue(value: SearchValue) {
  return Array.isArray(value) ? value[0] : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rewriteTargetHref(href: unknown) {
  if (typeof href !== "string") return href;
  if (href === "/targets") return "/network?view=saved";
  if (!href.startsWith("/targets?")) return href;

  const params = new URLSearchParams(href.slice(href.indexOf("?") + 1));
  if (params.get("view") !== "relationships") params.set("view", "saved");
  return `/network?${params.toString()}`;
}

function visibleDirectoryItems(value: unknown) {
  if (!Array.isArray(value)) return null;
  if (!value.some((item) => isRecord(item) && "reviewStatus" in item)) return null;
  return value.filter((item) => !isRecord(item) || item.reviewStatus !== "quarantined");
}

function rewriteNetworkTree(node: ReactNode, view: NetworkView): ReactNode {
  if (Array.isArray(node)) return node.map((child) => rewriteNetworkTree(child, view));
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<NetworkElementProps>;
  const props = element.props;
  const nextProps: Partial<NetworkElementProps> = {};

  const rewrittenHref = rewriteTargetHref(props.href);
  if (rewrittenHref !== props.href) nextProps.href = rewrittenHref;

  const visibleItems = visibleDirectoryItems(props.items);
  if (visibleItems) nextProps.items = visibleItems;

  const visibleDirectory = visibleDirectoryItems(props.directoryItems);
  if (visibleDirectory) {
    nextProps.directoryItems = visibleDirectory;
    if (Array.isArray(props.items)) {
      const allowedIds = new Set(
        visibleDirectory
          .filter(isRecord)
          .map((item) => item.id)
          .filter((id): id is string => typeof id === "string"),
      );
      nextProps.items = props.items.filter(
        (item) =>
          !isRecord(item)
          || typeof item.opportunityId !== "string"
          || allowedIds.has(item.opportunityId),
      );
    }
  }

  const rewrittenChildren = props.children === undefined
    ? undefined
    : rewriteNetworkTree(props.children, view);

  if (view !== "discover" && props.method === "get" && !props.action) {
    nextProps.action = "/network";
    nextProps.children = [
      <input key="network-view" type="hidden" name="view" value={view} />,
      rewrittenChildren,
    ];
  } else if (rewrittenChildren !== props.children) {
    nextProps.children = rewrittenChildren;
  }

  return cloneElement(element, nextProps);
}

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<NetworkSearchParams>;
}) {
  const params = await searchParams;
  const requestedView = firstValue(params.view);
  const view: NetworkView = requestedView === "saved" || requestedView === "relationships"
    ? requestedView
    : "discover";

  if (view !== "discover") {
    const rendered = await TargetsPage({
      searchParams: Promise.resolve({
        q: firstValue(params.q),
        type: firstValue(params.type),
        platform: firstValue(params.platform),
        contact: firstValue(params.contact),
        verification: firstValue(params.verification),
        page: firstValue(params.page),
        view,
      }),
    });
    return rewriteNetworkTree(rendered, view);
  }

  const rendered = await OpportunitiesPage({
    searchParams: Promise.resolve({ releaseId: firstValue(params.releaseId) }),
  });
  return rewriteNetworkTree(rendered, view);
}
