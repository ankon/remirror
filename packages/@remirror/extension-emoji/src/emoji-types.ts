import type { Handler } from '@remirror/core';
import type { SuggestChangeHandlerParameter } from '@remirror/pm/suggest';

import type AliasData from './data/aliases';
import type CategoryData from './data/categories';
import type EmojiData from './data/emojis';

export type Names = keyof typeof EmojiData;
export type AliasNames = keyof typeof AliasData;
export type Category = keyof typeof CategoryData;
export type NamesAndAliases = Names | AliasNames;

export interface EmojiObject {
  keywords: string[];
  char: string;
  category: string;
  name: string;
  description: string;
  skinVariations: boolean;
}

export interface EmojiSuggestionChangeHandlerParameter extends SuggestChangeHandlerParameter {
  /**
   * The currently matching objects
   *
   * @deprecated This will be replaced with a new way of using emojis.
   */
  emojiMatches: EmojiObject[];
}

export type SkinVariation = 0 | 1 | 2 | 3 | 4;

export type EmojiSuggestCommand = (emoji: EmojiObject, skinVariation?: SkinVariation) => void;
export type EmojiSuggestionChangeHandler = (
  parameter: EmojiSuggestionChangeHandlerParameter,
) => void;

export interface EmojiOptions {
  /**
   * The character which will trigger the emoji suggesters popup.
   */
  suggestionCharacter?: string;

  /**
   * A list of the initial (frequently used) emoji displayed to the user.
   * These are used when the query typed is less than two characters long.
   */
  defaultEmoji?: NamesAndAliases[];

  /**
   * Called whenever the suggestion value is updated.
   */
  onChange?: Handler<EmojiSuggestionChangeHandler>;

  /**
   * The maximum results to show when searching for matching emoji.
   *
   * @default 15
   */
  maxResults?: number;
}

export type EmojiObjectRecord = Record<Names, EmojiObject>;
