type AppMosaicParent = MosaicParent<ViewId>;
type AppMosaicNode = MosaicNode<ViewId>;

const isAppMosaicParent = (node: AppMosaicNode): node is AppMosaicParent => {
    return typeof node !== "string" && node.splitPercentage !== undefined;
};