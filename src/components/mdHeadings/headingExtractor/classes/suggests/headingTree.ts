import {
  App,
  WorkspaceLeaf,
  MarkdownView,
  TFile,
  Editor,
} from 'obsidian';

import registerKeybindings from 'utils/obsidian/keybindings';
import IconButton from "utils/obsidian/classes/iconButton";

import BaseAbstractSuggest from 'suggests/baseAbstractSuggest';
import { simpleHighlight, fuzzyHighlight } from "suggests/utils/display";

import { mdHeadingHTML } from "components/mdHeadings/utils/display";

import {
  MarkdownLevel,
  HeadingNode,
  HeadingTree,
} from "../../utils/dataStructures";



type MdTextSources = {
  file?: TFile;
  editor?: Editor;
  markdownText?: string;
};

export type HeadingTreeArgs = {
  sources: MdTextSources;
  mdLevelLimit?: MarkdownLevel;
  expand?: boolean;
};




/**
 * An abstract suggest class that builds a data tree and allows the user to navigate it.
 *
 * DEV-NOTE: Merge of `HeadingTreeSuggest` and `DataNodeSuggest<Heading>`
 */
export default abstract class HeadingTreeSuggest extends BaseAbstractSuggest<HeadingNode> {

  public file?: TFile;
  public editor?: Editor;
  public markdownText?: string;

  protected tree: HeadingTree;
  protected referenceNode: HeadingNode;

  private mdLevelLimit: MarkdownLevel;
  private selectionIndexStack: number[] = [];
  private selectionQueryStack: string[] = [];
  private referenceNodeStack: HeadingNode[] = [];


  constructor(app: App, args: HeadingTreeArgs) {
    super(app, "heading-tree-suggest");

    this.setPlaceholder("Select a Heading...");
    this.file = args.sources.file;
    this.editor = args.sources.editor;
    this.markdownText = args.sources.markdownText;
    this.mdLevelLimit = args.mdLevelLimit ?? 6;
    this.itemToString = (node: HeadingNode) => node.heading.header.text;
    this.setDisplayFunctions();

    this.flags.expand = args.expand ?? false;
    this.iconButtons.expand = new IconButton({
      parentEl: this.iconContainerEl,
      iconId: "expand",
      tooltip: "Expand All",
      isActive: this.flags.expand,
      clickCallback: () => this.toggleExpandAll(),
    });
  }


  async onOpen(): Promise<void> {
    registerKeybindings(this.scope, [
      [["Alt"],  "l", async () => await this.stepInto(this.renderedResults[this.selectionIndex])],
      [["Alt"],  "h", async () => await this.stepOut()],
      [["Alt"],  "d", () => this.toggleExpandAll()],
    ]);
  }


  async open(): Promise<void> {
    if (!this.tree) await this.buildTree();
    if (!this.tree) return;
    await super.open();
  }


  async buildTree(): Promise<void> {
    await this.setMarkdownText();
    if (!this.markdownText) return;
    this.tree = new HeadingTree(this.markdownText, this.mdLevelLimit);
    this.referenceNode = this.tree.root;
  }


  async setMarkdownText(): Promise<void> {
    if (this.markdownText) return;

    else if (this.editor)
      this.markdownText = this.editor.getValue();

    else if (this.file) {
      const activeViews = this.app.workspace.getLeavesOfType("markdown").map(
        (leaf: WorkspaceLeaf) => (leaf.view as MarkdownView)
      );
      const activeFiles = activeViews.map((view: MarkdownView) => view.file as TFile);
      const targetFileIndex = activeFiles.indexOf(this.file);
      if (targetFileIndex !== -1) {
        console.debug("File contents read from: WORKSPACE VIEW EDITOR");
        this.editor = activeViews[targetFileIndex].editor;
        this.markdownText = this.editor.getValue();
      } else {
        console.debug("File contents read from: DISK");
        this.markdownText = await this.app.vault.read(this.file);
      }
    }

    else {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) return;
      this.editor = view.editor;
      this.markdownText = this.editor.getValue();
    }
  }


  getSourceItems(sourceNode?: HeadingNode, filter?: (node: HeadingNode) => boolean): HeadingNode[] {
    if (!this.flags.expand) {
      if (!sourceNode) return this.referenceNode.children;
      else if (!filter) return sourceNode.children;
      else return sourceNode.children.filter(filter);
    }
    else return this.tree.flatten(filter, sourceNode);
  }


  async stepInto(result: HeadingNode): Promise<boolean> {
    if (result.children.length === 0) return false;
    this.referenceNodeStack.push(this.referenceNode);
    this.referenceNode = result;
    this.selectionIndexStack.push(this.selectionIndex);
    this.selectionQueryStack.push(this.query);
    await this.updateInputAndResults("");
    return true;
  }


  async stepOut(): Promise<boolean> {
    if (this.referenceNodeStack.length === 0) return false;
    this.referenceNode = this.referenceNodeStack.pop()!;
    await this.updateInputAndResults(
      this.selectionQueryStack.pop()!,
      this.selectionIndexStack.pop()!
    );
    return true;
  }


  toggleExpandAll(): void {
    this.flags.expand = !this.flags.expand;
    this.iconButtons.expand?.toggle(this.flags.expand);
    this.inputEl.dispatchEvent(new Event("input"));
    this.inputEl.focus();
  }


  setTree(tree: HeadingTree) {
    this.tree = tree;
    this.referenceNode = tree.root;
  }


  setDisplayFunctions() {
    this.defaultResultDisplay = (resultEl, node) => {
      resultEl.innerHTML = mdHeadingHTML(
        node.heading.level.bySyntax,
        node.heading.header.text,
        node.children.length,
      );
    };
    this.simpleResultDisplay = (resultEl, object) => {
      resultEl.innerHTML = mdHeadingHTML(
        object.item.heading.level.bySyntax,
        simpleHighlight(object.match, object.item.heading.header.text),
        object.item.children.length,
      );
    };
    this.fuzzyResultDisplay = (resultEl, object) => {
      resultEl.innerHTML = mdHeadingHTML(
        object.item.heading.level.bySyntax,
        fuzzyHighlight(object.fuzzyResult.matches, object.item.heading.header.text),
        object.item.children.length,
      );
    };
  }

}

