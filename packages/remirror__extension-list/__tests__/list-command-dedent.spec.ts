import { dedentListCommand } from '../src/list-command-dedent';
import { setupListEditor } from './list-setup';

describe('dedentList', () => {
  const { editor, doc, p, ul, ol, li, taskList, checked, unchecked } = setupListEditor();

  describe.each([
    { type: ol, name: 'ordered list', item: li },
    { type: ul, name: 'unordered list', item: li },
    { type: taskList, name: 'task list (checked items)', item: checked },
    { type: taskList, name: 'task list (unchecked items)', item: unchecked },
  ])('... for $name', ({ type, item }) => {
    it('dedents second list item', () => {
      const from = doc(type(item(p('item 1'), type(item(p('<cursor>item 2')))), item(p('item 3'))));
      const to = doc(type(item(p('item 1')), item(p('<cursor>item 2')), item(p('item 3'))));

      editor.add(from).dispatchCommand(dedentListCommand);
      expect(editor.view.state.doc).toEqualProsemirrorNode(to);
    });

    it('dedents with cursor not on start of list item', () => {
      const from = doc(type(item(p('item 1'), type(item(p('item <cursor>2')))), item(p('item 3'))));
      const to = doc(type(item(p('item 1')), item(p('item <cursor>2')), item(p('item 3'))));

      editor.add(from).dispatchCommand(dedentListCommand);
      expect(editor.view.state.doc).toEqualProsemirrorNode(to);
    });
  });
});
