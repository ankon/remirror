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

    it('does not indent first list item', () => {
      const from = doc(type(item(p('<cursor>item 1')), item(p('item 2')), item(p('item 3'))));

      editor.add(from).dispatchCommand(indentListCommand);
      expect(editor.view.state.doc).toEqualProsemirrorNode(from);
    });
  });
});
