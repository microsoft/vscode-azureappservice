import * as appservice from "vscode-azureappservice";
import { AzureTreeItem, IActionContext } from "vscode-azureextensionui";
import { SiteTreeItem } from "../../explorer/SiteTreeItem";
import { WebAppTreeItem } from "../../explorer/WebAppTreeItem";
import { ext } from "../../extensionVariables";

export async function editScmType(actionContext: IActionContext, node?: SiteTreeItem | appservice.DeploymentsTreeItem): Promise<void> {
    if (!node) {
        node = <SiteTreeItem>await ext.tree.showTreeItemPicker(WebAppTreeItem.contextValue);
    } else if (node instanceof appservice.DeploymentsTreeItem) {
        node = <SiteTreeItem>node.parent;
    }

    await appservice.editScmType(node.root.client, node, actionContext);
    const children: AzureTreeItem[] = await node.getCachedChildren();
    const deploymentsTreeItem: AzureTreeItem | undefined = children.find(ti => {
        return ti.label === appservice.DeploymentsTreeItem.contextValueConnected ||
            ti.contextValue === appservice.DeploymentsTreeItem.contextValueUnconnected;
    });

    // if we couldn't find the deployments treeItem, just refresh the parent
    deploymentsTreeItem ? await deploymentsTreeItem.refresh() : await node.refresh();
}
