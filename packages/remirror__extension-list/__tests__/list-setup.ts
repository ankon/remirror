import { renderEditor } from 'jest-remirror';
import {
  BulletListExtension,
  ListItemExtension,
  OrderedListExtension,
  TaskListExtension,
} from 'remirror/extensions';
import {
  ApplyStateLifecycleProps,
  extension,
  Handler,
  MetaExtension,
  PlainExtension,
} from '@remirror/core';

export type ApplyEventHandler = (props: ApplyStateLifecycleProps) => void;

export interface InterceptApplyStateOptions {
  onApplyState?: Handler<ApplyEventHandler>;
}

/**
 * Helper extension to be able to look into a tr when it is applied
 */
@extension<InterceptApplyStateOptions>({
  handlerKeys: ['onApplyState'],
  handlerKeyOptions: {
    onApplyState: { earlyReturnValue: false },
  },
})
export class InterceptApplyStateExtension extends PlainExtension<InterceptApplyStateOptions> {
  get name() {
    return 'intercept-apply-state' as const;
  }

  onApplyState(props: ApplyStateLifecycleProps): void {
    this.options.onApplyState(props);
  }
}

export function setupListEditor() {
  const editor = renderEditor([
    new MetaExtension({ capture: true }),
    new ListItemExtension(),
    new BulletListExtension(),
    new OrderedListExtension(),
    new TaskListExtension(),
  ]);
  const {
    nodes: { doc, paragraph: p, bulletList: ul, orderedList: ol, listItem: li, taskList },
    attributeNodes: { taskListItem, orderedList, listItem },
  } = editor;

  const checked = taskListItem({ checked: true });
  const unchecked = taskListItem({ checked: false });

  return {
    editor,
    doc,
    p,
    ul,
    li,
    ol,
    taskList,
    orderedList,
    checked,
    unchecked,
    taskListItem,
    listItem,
  };
}
