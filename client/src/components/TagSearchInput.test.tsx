import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import TagSearchInput from './TagSearchInput'
import type { Chip } from '../utils/searchQuery'

const CATEGORIES = ['Promotions', 'Social']

function Harness({ onSearch = vi.fn(), onClear = vi.fn() }: { onSearch?: (c: Chip[]) => void; onClear?: () => void }) {
  const [chips, setChips] = useState<Chip[]>([])
  return (
    <ChakraProvider>
      <TagSearchInput chips={chips} onChipsChange={setChips} onSearch={onSearch} onClear={onClear} categories={CATEGORIES} />
    </ChakraProvider>
  )
}

const input = () => screen.getByPlaceholderText(/tag:/i) as HTMLInputElement

describe('TagSearchInput', () => {
  it('creates a chip on Enter and clears the input', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: 'tag:Promotions' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(screen.getByText('tag:Promotions')).toBeTruthy()
    expect(input().value).toBe('')
  })

  it('removes the last chip on Backspace when the input is empty', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: 'from:amazon' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(screen.getByText('from:amazon')).toBeTruthy()
    fireEvent.keyDown(input(), { key: 'Backspace' })
    expect(screen.queryByText('from:amazon')).toBeNull()
  })

  it('disables Search while an invalid chip is present', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: 'tag:banana' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    const search = screen.getByRole('button', { name: /^search$/i }) as HTMLButtonElement
    expect(search.disabled).toBe(true)
  })

  it('fires onSearch with the chips (converting leftover input text first)', () => {
    const onSearch = vi.fn()
    render(<Harness onSearch={onSearch} />)
    fireEvent.change(input(), { target: { value: 'tag:Promotions' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    fireEvent.change(input(), { target: { value: 'from:amazon' } })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalledTimes(1)
    const chips = onSearch.mock.calls[0][0] as Chip[]
    expect(chips.map((c) => `${c.field}:${c.value}`)).toEqual(['tag:Promotions', 'from:amazon'])
  })

  it('fires onSearch on Enter with an empty input and valid chips', () => {
    const onSearch = vi.fn()
    render(<Harness onSearch={onSearch} />)
    fireEvent.change(input(), { target: { value: 'from:amazon' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('fires onClear from the Clear button', () => {
    const onClear = vi.fn()
    render(<Harness onClear={onClear} />)
    fireEvent.change(input(), { target: { value: 'from:amazon' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('keeps focus in the input after a chip is added with Enter', () => {
    render(<Harness />)
    input().focus()
    fireEvent.change(input(), { target: { value: 'tag:Promotions' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(screen.getByText('tag:Promotions')).toBeTruthy()
    expect(document.activeElement).toBe(input())
  })

  it('shows suggestions in an ARIA listbox while the input is focused', () => {
    render(<Harness />)
    fireEvent.focus(input())
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeTruthy()
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
    expect(options[0].textContent).toBe('tag:')
  })

  it('renders the suggestion list in a portal so ancestor stacking contexts cannot hide it', () => {
    render(<Harness />)
    fireEvent.focus(input())
    const listbox = screen.getByRole('listbox')
    // Portaled to document.body — NOT a DOM descendant of the input's field wrapper.
    // Regression guard: theme Cards apply backdropFilter (a stacking context), which
    // trapped the in-flow absolute dropdown behind later siblings.
    expect(listbox.closest('.chakra-portal')).toBeTruthy()
    expect(input().parentElement!.contains(listbox)).toBe(false)
  })

  it('selects the active suggestion with ArrowDown + Enter and keeps focus', () => {
    render(<Harness />)
    input().focus()
    fireEvent.focus(input())
    fireEvent.keyDown(input(), { key: 'ArrowDown' }) // activate 'tag:'
    fireEvent.keyDown(input(), { key: 'Enter' })
    // prefix suggestion fills the input rather than committing a chip
    expect(input().value).toBe('tag:')
    expect(document.activeElement).toBe(input())
    // now the category values are suggested; pick the first (tag:Promotions)
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(screen.getByText('tag:Promotions')).toBeTruthy()
    expect(input().value).toBe('')
    expect(document.activeElement).toBe(input())
  })

  it('closes the suggestion list on Escape', () => {
    render(<Harness />)
    fireEvent.focus(input())
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
