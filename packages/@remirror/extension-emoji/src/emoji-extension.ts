import escapeStringRegex from 'escape-string-regexp';

import type { CommandFunction, InputRule } from '@remirror/core';
import {
  extensionDecorator,
  FromToParameter,
  object,
  PlainExtension,
  plainInputRule,
} from '@remirror/core';
import type { Suggester } from '@remirror/pm/suggest';

import type { EmojiObject, EmojiOptions, NamesAndAliases, SkinVariation } from './emoji-types';
import {
  DEFAULT_FREQUENTLY_USED,
  emoticonRegex,
  getEmojiByName,
  getEmojiFromEmoticon,
  populateFrequentlyUsed,
  SKIN_VARIATIONS,
  sortEmojiMatches,
} from './emoji-utils';

@extensionDecorator<EmojiOptions>({
  defaultOptions: {
    defaultEmoji: DEFAULT_FREQUENTLY_USED,
    suggestionCharacter: ':',
    maxResults: 20,
  },
  handlerKeys: ['onChange'],
})
export class EmojiExtension extends PlainExtension<EmojiOptions> {
  /**
   * The name is dynamically generated based on the passed in type.
   */
  get name() {
    return 'emoji';
  }

  /**
   * Keep track of the frequently used list.
   */
  private frequentlyUsed: EmojiObject[] = populateFrequentlyUsed(this.options.defaultEmoji);

  /**
   * Manage input rules for emoticons.
   */
  createInputRules(): InputRule[] {
    return [
      // Emoticons
      plainInputRule({
        regexp: emoticonRegex,
        transformMatch: ([full, partial]) => {
          const emoji = getEmojiFromEmoticon(partial);
          return emoji ? full.replace(partial, emoji.char) : null;
        },
      }),

      // Emoji Names
      plainInputRule({
        regexp: /:([\w-]+):$/,
        transformMatch: ([, match]) => {
          const emoji = getEmojiByName(match);
          return emoji ? emoji.char : null;
        },
      }),
    ];
  }

  createCommands() {
    const commands = {
      /**
       * Insert an emoji into the document at the requested location by name
       *
       * The range is optional and if not specified the emoji will be inserted
       * at the current selection.
       *
       * @param name - the emoji to insert
       * @param [options] - the options when inserting the emoji.
       */
      insertEmojiByName: (
        name: string,
        options: EmojiCommandOptions = object(),
      ): CommandFunction => (parameter) => {
        const emoji = getEmojiByName(name);

        if (!emoji) {
          return false;
        }

        return commands.insertEmojiByObject(emoji, options)(parameter);
      },

      /**
       * Insert an emoji into the document at the requested location.
       *
       * The range is optional and if not specified the emoji will be inserted
       * at the current selection.
       *
       * @param emoji - the emoji object to use.
       * @param [range] - the from/to position to replace.
       */
      insertEmojiByObject: (
        emoji: EmojiObject,
        { from, to, skinVariation }: EmojiCommandOptions = object(),
      ): CommandFunction => ({ tr, dispatch }) => {
        const emojiChar = skinVariation ? emoji.char + SKIN_VARIATIONS[skinVariation] : emoji.char;
        tr.insertText(emojiChar, from, to);

        if (dispatch) {
          dispatch(tr);
        }

        return true;
      },

      /**
       * Inserts the suggestion character into the current position in the
       * editor in order to activate the suggestion popup.
       */
      suggestEmoji: ({ from, to }: Partial<FromToParameter> = object()): CommandFunction => ({
        state,
        dispatch,
      }) => {
        if (dispatch) {
          dispatch(state.tr.insertText(this.options.suggestionCharacter, from, to));
        }

        return true;
      },
    };

    return commands;
  }

  createHelpers() {
    return {
      /**
       * Update the emoji which are displayed to the user when the query is not
       * specific enough.
       */
      updateFrequentlyUsed: (names: NamesAndAliases[]) => {
        this.frequentlyUsed = populateFrequentlyUsed(names);
      },
    };
  }

  /**
   * Emojis can be selected via `:` the colon key (by default). This sets the
   * configuration using `prosemirror-suggest`
   */
  createSuggesters(): Suggester {
    return {
      noDecorations: true,
      invalidPrefixCharacters: `${escapeStringRegex(this.options.suggestionCharacter)}|\\w`,
      char: this.options.suggestionCharacter,
      name: this.name,
      appendText: '',
      suggestTag: 'span',
      onChange: (parameters) => {
        const query = parameters.query.full;
        const emojiMatches =
          query.length === 0
            ? this.frequentlyUsed
            : sortEmojiMatches(query, this.options.maxResults);
        this.options.onChange({ ...parameters, emojiMatches });
      },
    };
  }
}

export interface EmojiCommandOptions extends Partial<FromToParameter> {
  /**
   * The skin variation which is a number between `0` and `4`.
   */
  skinVariation?: SkinVariation;
}
