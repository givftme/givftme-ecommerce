import { type SchemaTypeDefinition } from 'sanity'
import { attributeOption } from './attributeOption'
import { collection } from './collection'
import { occasion } from './occasion'
import { product } from './product'
import { productVariant } from './productVariant'
import { supplier } from './supplier'
import { variantAttribute } from './variantAttribute'

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    supplier,
    occasion,
    collection,
    product,
    attributeOption,
    variantAttribute,
    productVariant,
  ],
}
