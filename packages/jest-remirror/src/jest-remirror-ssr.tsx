import React from 'react';
import { renderToString } from 'react-dom/server';

import { AnyExtension, EditorManager, object } from '@remirror/core';
import { RenderEditor, RenderEditorProps } from '@remirror/react';

import { nodeExtensions } from './jest-remirror-schema';

/**
 * Render the editor with the params passed in. Useful for testing.
 */
export const renderSSREditor = <GExtension extends AnyExtension = any>(
  extensions: GExtension[] = [],
  props: Partial<Omit<RenderEditorProps<GExtension>, 'manager'>> = object(),
): string => {
  const manager = EditorManager.create([...nodeExtensions, ...extensions]);

  return renderToString(
    <RenderEditor {...props} manager={manager as any}>
      {(params) => {
        if (props.children) {
          return props.children(params);
        }
        return <div />;
      }}
    </RenderEditor>,
  );
};
