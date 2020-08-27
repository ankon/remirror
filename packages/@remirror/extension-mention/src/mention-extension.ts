import type { Handler, ProsemirrorAttributes, Static } from '@remirror/core';
import {
  ApplySchemaAttributes,
  bool,
  CommandFunction,
  ErrorConstant,
  extensionDecorator,
  ExtensionTag,
  getMarkRange,
  getMatchString,
  invariant,
  isElementDomNode,
  isPlainObject,
  isString,
  MarkExtension,
  MarkExtensionSpec,
  markPasteRule,
  object,
  pick,
  ProsemirrorPlugin,
  RangeParameter,
  removeMark,
  replaceText,
} from '@remirror/core';
import type { RangeWithCursor, SuggestChangeHandler, Suggester } from '@remirror/pm/suggest';
import { createRegexFromSuggester, DEFAULT_SUGGESTER } from '@remirror/pm/suggest';

/**
 * The mention extension wraps mentions as a prosemirror mark. It allows for
 * very fluid and flexible social experiences to be built up.
 *
 * @remarks
 *
 * Mentions have the following features
 * - An activation character you define.
 * - A min number of characters before mentions are suggested
 * - Ability to exclude matching character
 * - Ability to wrap content in a decoration which excludes mentions from being
 *   suggested.
 * - Decorations for in progress mentions
 * - Keybindings for handling arrow keys and other more exotic commands.
 *
 * Please note, there is still a lot of work required in your view layer when
 * creating a mention and it's not at trivial (I found it quite difficult). With
 * remirror I'm hoping to reduce the cognitive strain required to set up
 * mentions in your own editor.
 */
@extensionDecorator<MentionOptions>({
  defaultOptions: {
    mentionTag: 'a' as const,
    matchers: [],
    appendText: ' ',
    suggestTag: 'a' as const,
    noDecorations: false,
  },
  handlerKeys: ['onChange'],
  staticKeys: ['matchers', 'mentionTag'],
})
export class MentionExtension extends MarkExtension<MentionOptions> {
  get name() {
    return 'mention' as const;
  }

  /**
   * Tag this as a behavior influencing mark.
   */
  readonly tags = [ExtensionTag.Behavior];

  createMarkSpec(extra: ApplySchemaAttributes): MarkExtensionSpec {
    const dataAttributeId = 'data-mention-id';
    const dataAttributeName = 'data-mention-name';

    return {
      attrs: {
        ...extra.defaults(),
        id: {},
        label: {},
        name: {},
      },
      excludes: '_',
      inclusive: false,
      parseDOM: [
        {
          tag: `${this.options.mentionTag}[${dataAttributeId}]`,
          getAttrs: (element) => {
            if (!isElementDomNode(element)) {
              return false;
            }

            const id = element.getAttribute(dataAttributeId);
            const name = element.getAttribute(dataAttributeName);
            const label = element.textContent;
            return { ...extra.parse(element), id, label, name };
          },
        },
      ],
      toDOM: (mark) => {
        const {
          label: _,
          id,
          name,
          replacementType,
          range,
          ...attributes
        } = mark.attrs as Required<MentionExtensionAttributes>;
        const matcher = this.options.matchers.find((matcher) => matcher.name === name);

        const mentionClassName = matcher
          ? matcher.mentionClassName ?? DEFAULT_MATCHER.mentionClassName
          : DEFAULT_MATCHER.mentionClassName;

        return [
          this.options.mentionTag,
          {
            ...extra.dom(mark),
            ...attributes,
            class: name ? `${mentionClassName} ${mentionClassName}-${name}` : mentionClassName,
            [dataAttributeId]: id,
            [dataAttributeName]: name,
          },
          0,
        ];
      },
    };
  }

  createCommands() {
    return {
      /**
       * Create a new mention
       */
      createMention: this.createMention({ shouldUpdate: false }),

      /**
       * Update an existing mention.
       */
      updateMention: this.createMention({ shouldUpdate: true }),

      /**
       * Remove the mention(s) at the current selection or provided range.
       */
      removeMention: ({ range }: Partial<RangeParameter> = object()) =>
        removeMark({ type: this.type, expand: true, range }),
    };
  }

  createPasteRules(): ProsemirrorPlugin[] {
    return this.options.matchers.map((matcher) => {
      const { startOfLine, char, supportedCharacters, name, matchOffset } = {
        ...DEFAULT_MATCHER,
        ...matcher,
      };

      const regexp = new RegExp(
        `(${
          createRegexFromSuggester({
            char,
            matchOffset,
            startOfLine,
            supportedCharacters,
            captureChar: true,
          }).source
        })`,
        'g',
      );

      return markPasteRule({
        regexp,
        type: this.type,
        getAttributes: (string) => ({
          id: getMatchString(string.slice(string[2].length, string.length)),
          label: getMatchString(string),
          name,
        }),
      });
    });
  }

  createSuggesters(): Suggester[] {
    return this.options.matchers.map<Suggester>((matcher) => {
      return {
        ...DEFAULT_MATCHER,
        ...matcher,

        // The following properties are provided as getter so that the
        // prosemirror-suggest plugin always references the latest version of
        // the suggestion. This is not a good idea and should be fixed in a
        // better way soon.
        noDecorations: this.options.noDecorations,
        suggestTag: this.options.suggestTag,
        onChange: this.options.onChange,
      };
    });
  }

  /**
   * The factory method for mention commands to update and create new mentions.
   */
  private createMention({ shouldUpdate }: CreateMentionParameter) {
    return (config: MentionExtensionAttributes & { keepSelection?: boolean }): CommandFunction => {
      invariant(isValidMentionAttributes(config), {
        message: 'Invalid configuration attributes passed to the MentionExtension command.',
      });

      const { range, appendText, replacementType, keepSelection, ...attributes } = config;
      let name = attributes.name;

      if (!name) {
        invariant(this.options.matchers.length < 2, {
          code: ErrorConstant.EXTENSION,
          message:
            'The MentionExtension command must specify a name since there are multiple matchers configured',
        });

        name = this.options.matchers[0].name;
      }

      const allowedNames = this.options.matchers.map(({ name }) => name);

      invariant(allowedNames.includes(name), {
        code: ErrorConstant.EXTENSION,
        message: `The name '${name}' specified for this command is invalid. Please choose from: ${JSON.stringify(
          allowedNames,
        )}.`,
      });

      const matcher = getMatcher(name, this.options.matchers);

      invariant(matcher, {
        code: ErrorConstant.EXTENSION,
        message: `Mentions matcher not found for name ${name}.`,
      });

      return (parameter) => {
        const { tr } = parameter;
        const { from, to } = range ?? tr.selection;

        if (shouldUpdate) {
          // Remove mark at previous position
          let { oldFrom, oldTo } = { oldFrom: from, oldTo: range ? range.to : to };
          const $oldTo = tr.doc.resolve(oldTo);

          ({ from: oldFrom, to: oldTo } = getMarkRange($oldTo, this.type) || {
            from: oldFrom,
            to: oldTo,
          });

          tr.removeMark(oldFrom, oldTo, this.type).setMeta('addToHistory', false);

          // Remove mark at current position
          const $newTo = tr.selection.$from;
          const { from: newFrom, to: newTo } = getMarkRange($newTo, this.type) || {
            from: $newTo.pos,
            to: $newTo.pos,
          };

          tr.removeMark(newFrom, newTo, this.type).setMeta('addToHistory', false);
        }

        return replaceText({
          keepSelection,
          type: this.type,
          attrs: { ...attributes, name },
          appendText: getAppendText(appendText, matcher.appendText),
          range: range ? { from, to: replacementType === 'full' ? range.to || to : to } : undefined,
          content: attributes.label,
        })(parameter);
      };
    };
  }
}

export interface OptionalMentionExtensionParameter {
  /**
   * The text to append to the replacement.
   *
   * @default ''
   */
  appendText?: string;

  /**
   * The range of the requested selection.
   */
  range?: RangeWithCursor;

  /**
   * Whether to replace the whole match (`full`) or just the part up until the
   * cursor (`partial`).
   */
  replacementType: 'full' | 'partial';
}

/**
 * The attrs that will be added to the node.
 * ID and label are plucked and used while attributes like href and role can be assigned as desired.
 */
export type MentionExtensionAttributes = ProsemirrorAttributes<
  OptionalMentionExtensionParameter & {
    /**
     * A unique identifier for the suggesters node
     */
    id: string;

    /**
     * The text to be placed within the suggesters node
     */
    label: string;

    /**
     * The identifying name for the matcher.
     */
    name: string;
  }
>;

/**
 * The options for the matchers which can be created by this extension.
 */
export interface MentionExtensionMatcher
  extends Pick<
    Suggester,
    | 'char'
    | 'name'
    | 'startOfLine'
    | 'supportedCharacters'
    | 'validPrefixCharacters'
    | 'invalidPrefixCharacters'
    | 'matchOffset'
    | 'suggestClassName'
  > {
  /**
   * Provide customs class names for the completed mention
   */
  mentionClassName?: string;

  /**
   * Text to append after the suggestion has been added.
   *
   * @default ''
   */
  appendText?: string;
}

/**
 * The static settings passed into a mention
 */
export interface MentionOptions {
  /**
   * Provide a custom tag for the mention
   */
  mentionTag?: Static<string>;

  /**
   * Provide the custom matchers that will be used to match mention text in the
   * editor.
   */
  matchers: Static<MentionExtensionMatcher[]>;

  /**
   * Text to append after the mention has been added.
   *
   * **NOTE**: For some reason prosemirror seems to swallow up empty whitespace. You can get around this by using a non breaking space character '\u00A0'.
   *
   * ```ts
   * import { NON_BREAKING_SPACE_CHAR } from '@remirror/core';
   * ```
   *
   * @default ''
   */
  appendText?: string;
  /**
   * Tag for the prosemirror decoration which wraps an active match.
   *
   * @default 'span'
   */
  suggestTag?: string;

  /**
   * When true, decorations are not created when this mention is being edited..
   */
  noDecorations?: boolean;

  /**
   * Called whenever a suggestion becomes active or changes in any way.
   *
   * @remarks
   *
   * It receives a parameters object with the `reason` for the change for more
   * granular control.
   *
   * @default `() => void`
   */
  onChange?: Handler<SuggestChangeHandler>;
}

/**
 * The dynamic properties used to change the behavior of the mentions created.
 */

export type SuggestionCommandAttributes = ProsemirrorAttributes<
  Partial<Pick<MentionExtensionAttributes, 'id' | 'label' | 'appendText' | 'replacementType'>> &
    object
>;

interface CreateMentionParameter {
  /**
   * Whether the mention command should handle updates.
   */
  shouldUpdate: boolean;
}

/**
 * The default matcher to use when none is provided in options
 */
const DEFAULT_MATCHER = {
  ...pick(DEFAULT_SUGGESTER, [
    'startOfLine',
    'supportedCharacters',
    'validPrefixCharacters',
    'invalidPrefixCharacters',
    'suggestClassName',
  ]),
  appendText: ' ',
  matchOffset: 1,
  mentionClassName: 'mention',
};

/**
 * Check that the attributes exist and are valid for the mention update
 * command method.
 */
function isValidMentionAttributes(attributes: unknown): attributes is MentionExtensionAttributes {
  return bool(attributes && isPlainObject(attributes) && attributes.id && attributes.label);
}

/**
 * Gets the matcher from the list of matchers if it exists.
 *
 * @param name - the name of the matcher to find
 * @param matchers - the list of matchers to search through
 */
function getMatcher(name: string, matchers: MentionExtensionMatcher[]) {
  const matcher = matchers.find((matcher) => matcher.name === name);
  return matcher ? { ...DEFAULT_MATCHER, ...matcher } : undefined;
}

/**
 * Get the append text value which needs to be handled carefully since it can
 * also be an empty string.
 */
function getAppendText(preferred: string | undefined, fallback: string | undefined) {
  if (isString(preferred)) {
    return preferred;
  }

  if (isString(fallback)) {
    return fallback;
  }

  return DEFAULT_MATCHER.appendText;
}
