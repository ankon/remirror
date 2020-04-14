/** @jsx jsx */

import { jsx } from '@emotion/core';
import { ComponentType, Fragment, ReactNode } from 'react';

import {
  AnyExtension,
  bool,
  DOMOutputSpec,
  EditorManager,
  Fragment as ProsemirrorFragment,
  isArray,
  isPlainObject,
  isString,
  Mark,
  MarkExtensionSpec,
  NodeExtensionSpec,
  object,
  PlainObject,
  ProsemirrorNode,
} from '@remirror/core';

import { gatherToDOM, mapProps } from './renderer-utils';

type NodeToDOM = NodeExtensionSpec['toDOM'];
type MarkToDOM = MarkExtensionSpec['toDOM'];

/**
 * Serialize the extension provided schema into a JSX element that can be displayed node and non-dom environments.
 */
export class ReactSerializer<GExtension extends AnyExtension = any> {
  public nodes: Record<string, NodeToDOM>;
  public marks: Record<string, MarkToDOM>;
  private readonly components: Record<string, ComponentType<any>>;
  private readonly options: Record<string, PlainObject>;

  constructor(
    nodes: Record<string, NodeToDOM>,
    marks: Record<string, MarkToDOM>,
    manager: EditorManager<GExtension>,
  ) {
    this.nodes = nodes;
    this.marks = marks;
    this.components = manager.components;
    this.options = manager.options;
  }

  /**
   * The main entry method on this class for traversing through a schema tree and creating JSx.
   *
   * ```ts
   * reactSerializer.serializeFragment(fragment)
   * ```
   *
   * @param fragment
   */
  public serializeFragment(fragment: ProsemirrorFragment): JSX.Element {
    const children: ReactNode[] = [];

    fragment.forEach((node) => {
      let child: ReactNode;
      child = this.serializeNode(node);
      node.marks.reverse().forEach((mark) => {
        // TODO test behaviour expectations for `spanning` marks. Currently not HANDLED.
        child = this.serializeMark(mark, node.isInline, child);
      });

      children.push(child);
    });

    return jsx(Fragment, {}, ...children);
  }

  /**
   * Transform the passed in node into a JSX Element
   *
   * @param node
   */
  public serializeNode(node: ProsemirrorNode): ReactNode {
    const Component = this.components[node.type.name];
    const options = this.options[node.type.name];
    const toDOM = this.nodes[node.type.name];

    let children: ReactNode;

    if (node.content.childCount > 0) {
      children = this.serializeFragment(node.content);
    }
    return bool(Component) ? (
      <Component options={options} node={node}>
        {children}
      </Component>
    ) : (
      toDOM && ReactSerializer.renderSpec(toDOM(node), children)
    );
  }

  /**
   * Transform the provided mark into a JSX Element that wraps the current node
   *
   * @param mark
   * @param inline
   * @param wrappedElement
   */
  public serializeMark(mark: Mark, inline: boolean, wrappedElement: ReactNode): ReactNode {
    const toDOM = this.marks[mark.type.name];
    const Component = this.components[mark.type.name];
    const options = this.options[mark.type.name];

    return bool(Component) ? (
      <Component options={options} mark={mark}>
        {wrappedElement}
      </Component>
    ) : (
      toDOM && ReactSerializer.renderSpec(toDOM(mark, inline), wrappedElement)
    );
  }

  /**
   * Receives the return value from toDOM defined in the node schema and transforms it
   * into JSX
   *
   * @param structure - The DOMOutput spec for the current node
   * @param wraps - passed through any elements that this component should be parent of
   */
  public static renderSpec(structure: DOMOutputSpec, wraps?: ReactNode): ReactNode {
    if (isString(structure)) {
      return structure;
    }

    const Component = structure[0];
    const props: PlainObject = object();
    const attributes = structure[1];
    const children: ReactNode[] = [];
    let currentIndex = 1;
    if (isPlainObject(attributes) && !isArray(attributes)) {
      currentIndex = 2;
      for (const name in attributes) {
        if (attributes[name] != null) {
          props[name] = attributes[name];
        }
      }
    }

    for (let ii = currentIndex; ii < structure.length; ii++) {
      const child = structure[ii];
      if (child === 0) {
        if (ii < structure.length - 1 || ii > currentIndex) {
          throw new RangeError('Content hole (0) must be the only child of its parent node');
        }
        return jsx(Component, mapProps(props), wraps);
      }
      children.push(ReactSerializer.renderSpec(child, wraps));
    }

    return jsx(Component, mapProps(props), ...children);
  }

  /**
   * Create a serializer from the extension manager
   *
   * @param manager
   */
  public static fromManager<GExtension extends AnyExtension = any>(
    manager: EditorManager<GExtension>,
  ) {
    return new ReactSerializer(
      this.nodesFromManager(manager),
      this.marksFromManager(manager),
      manager,
    );
  }

  /**
   * Pluck nodes from the extension manager
   *
   * @param manager
   */
  private static nodesFromManager<GExtension extends AnyExtension = any>(
    manager: EditorManager<GExtension>,
  ) {
    const result = gatherToDOM(manager.nodes);
    if (!result.text) {
      result.text = (node) => (node.text ? node.text : '');
    }
    return result;
  }

  /**
   * Pluck marks from the extension manager
   *
   * @param manager
   */
  private static marksFromManager<GExtension extends AnyExtension = any>(
    manager: EditorManager<GExtension>,
  ) {
    return gatherToDOM(manager.marks);
  }
}
