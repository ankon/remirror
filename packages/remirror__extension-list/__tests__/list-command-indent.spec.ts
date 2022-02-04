import { getTextSelection } from '@remirror/core';

import { indentListCommand } from '../src/list-command-indent';
import { setupListEditor } from './list-setup';

describe('indentList', () => {
  const { editor, doc, p, ul, ol, li, taskList, checked, unchecked } = setupListEditor();

  describe.each([
    { type: ol, name: 'ordered list', item: li },
    { type: ul, name: 'unordered list', item: li },
    { type: taskList, name: 'task list (checked items)', item: checked },
    { type: taskList, name: 'task list (unchecked items)', item: unchecked },
  ])('... for $name', ({ type, item }) => {
    it('indents second list item', () => {
      const from = doc(type(item(p('item 1')), item(p('<cursor>item 2')), item(p('item 3'))));
      const to = doc(type(item(p('item 1'), type(item(p('<cursor>item 2')))), item(p('item 3'))));

      editor.add(from).dispatchCommand(indentListCommand);
      expect(editor.view.state.doc).toEqualProsemirrorNode(to);
    });

    it('indents with cursor not on start of list item', () => {
      const from = doc(type(item(p('item 1')), item(p('item <cursor>2')), item(p('item 3'))));
      const to = doc(type(item(p('item 1'), type(item(p('item <cursor>2')))), item(p('item 3'))));

      editor.add(from).dispatchCommand(indentListCommand);
      expect(editor.view.state.doc).toEqualProsemirrorNode(to);
    });

    it('indents list item in selection', () => {
      const from = doc(type(item(p('item 1')), item(p('<start>item <end>2')), item(p('item 3'))));
      const to = doc(
        type(item(p('item 1'), type(item(p('<start>item <end>2')))), item(p('item 3'))),
      );

      editor.add(from).dispatchCommand(indentListCommand);
      expect(editor.view.state.doc).toEqualProsemirrorNode(to);
    });

    it('indents all selected list items', () => {
      const from = doc(type(item(p('item 1')), item(p('<start>item 2')), item(p('item<end> 3'))));
      const to = doc(
        type(
          item(
            p('item 1'),
            type(
              item(p('<start>item 2')), //
              item(p('item<end> 3')),
            ),
          ),
        ),
      );

      editor.add(from).dispatchCommand(indentListCommand);
      expect(editor.view.state.doc).toEqualProsemirrorNode(to);
    });

    it('does not indent first list item', () => {
      const from = doc(type(item(p('<cursor>item 1')), item(p('item 2')), item(p('item 3'))));

      editor.add(from).dispatchCommand(indentListCommand);
      expect(editor.view.state.doc).toEqualProsemirrorNode(from);
    });

    it('retains positions inside the previous item', () => {
      // 'start' and 'end' markers are just here to pick the positions easily.
      const from = doc(
        p('Content before'),
        type(item(p('it<start>em 1')), item(p('<end>item 2')), item(p('item 3'))),
        p('Content after'),
      );
      const to = doc(
        p('Content before'),
        type(item(p('item 1'), type(item(p('<cursor>item 2')))), item(p('item 3'))),
        p('Content after'),
      );

      /** Position that shouldn't move */
      let position = -1;
      /** Mapped position inside the tr */
      let mappedPosition = -1;
      /** Comparison position that should be behind position in all cases */
      let checkPosition = -1;
      /** Mapped comparison position */
      let mappedCheckPosition = -1;

      const interceptApplyStateExtension = editor.manager.getExtension(
        InterceptApplyStateExtension,
      );
      interceptApplyStateExtension.addHandler('onApplyState', ({ tr }) => {
        const commandMeta = editor.manager.store
          .getCommandMeta(tr)
          .find(({ type }) => type === 'command') as { name: string } | undefined;

        if (commandMeta?.name === 'indentList') {
          // IndentList tr: Capture the mapped positions
          mappedPosition = tr.mapping.map(position);
          mappedCheckPosition = tr.mapping.map(checkPosition);
          console.log(
            `Position in was ${position} (check ${checkPosition}), mapped to ${mappedPosition} (check ${mappedCheckPosition})`,
          );
        }
      });

      editor
        .add(from)
        .callback(({ from, to, doc, view }) => {
          position = from;
          checkPosition = to;
          // Clear the helper selection and move the cursor onto 'end' for the indent command
          const selection = getTextSelection(to, doc);
          view.dispatch(view.state.tr.setSelection(selection));
        })
        .dispatchCommand(indentListCommand);

      // Sanity check: Should have indented things
      expect(editor.view.state.doc).toEqualProsemirrorNode(to);
      expect(mappedPosition).toBeLessThan(mappedCheckPosition);
    });

    it('retains positions inside the item', () => {
      // 'start' and 'end' markers are just here to pick the positions easily.
      const from = doc(
        p('Content before'),
        type(item(p('item 1')), item(p('<start>item<end> 2')), item(p('item 3'))),
        p('Content after'),
      );
      const to = doc(
        p('Content before'),
        type(item(p('item 1'), type(item(p('<cursor>item 2')))), item(p('item 3'))),
        p('Content after'),
      );

      /** Position that shouldn't move */
      let position = -1;
      /** Mapped position inside the tr */
      let mappedPosition = -1;
      /** Comparison position that should be behind position in all cases */
      let checkPosition = -1;
      /** Mapped comparison position */
      let mappedCheckPosition = -1;

      const interceptApplyStateTransaction = editor.manager.getExtension(
        InterceptApplyStateExtension,
      );
      interceptApplyStateTransaction.addHandler('onApplyState', ({ tr }) => {
        const { command } = tr.getMeta(ListItemSharedExtension.name) ?? {};

        if (command === 'indentList') {
          // IndentList tr: Capture the mapped positions
          mappedPosition = tr.mapping.map(position);
          mappedCheckPosition = tr.mapping.map(checkPosition);
          console.log(
            `Position in was ${position} (check ${checkPosition}), mapped to ${mappedPosition} (check ${mappedCheckPosition})`,
          );
        }
      });

      editor
        .add(from)
        .callback(({ from, to, doc, view }) => {
          position = from;
          checkPosition = to;
          // Clear the helper selection and move the cursor onto 'end' for the indent command
          const selection = getTextSelection(to, doc);
          view.dispatch(view.state.tr.setSelection(selection));
        })
        .dispatchCommand(indentListCommand);

      // Sanity check: Should have indented things
      expect(editor.view.state.doc).toEqualProsemirrorNode(to);
      expect(mappedPosition).toBeLessThan(mappedCheckPosition);
    });
  });
});
