import { ExternalLink, Mail, MapPin, Phone, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface VendorCardProps {
  vendor: {
    businessName: string
    email?: string
    phone?: string
    address?: string
    rating?: number
    url?: string
    specialty?: string
    services?: Array<string>
  }
  quote?: {
    _id: string
    price: number
    currency: string
    status: string
    estimatedDeliveryTime?: number
    responseText?: string
    createdAt: number
  }
  variant?: 'quote' | 'discovered'
  className?: string
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function VendorCard({ vendor, quote, variant = 'discovered', className = '' }: VendorCardProps) {
  const priceInDollars = quote ? quote.price / 100 : undefined

  return (
    <section className={`p-4 rounded-2xl bg-zinc-100 ${className}`}>
      <section className="space-y-2">
        <section className="flex items-center justify-between">
          <h4 className="font-medium text-sm">{vendor.businessName}</h4>
          {quote ? (
            <Badge variant="outline" className="text-xs">
              {quote.status}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
              Discovered
            </Badge>
          )}
        </section>

        {/* Quote details (if vendor has a quote) */}
        {quote && (
          <>
            <section className="flex items-center gap-2">
              <p className="text-sm font-semibold">
                {quote.currency} ${priceInDollars?.toFixed(2)}
              </p>
              {quote.estimatedDeliveryTime && (
                <span className="text-xs text-muted-foreground">
                  • {quote.estimatedDeliveryTime}h
                </span>
              )}
            </section>
            {quote.responseText && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {quote.responseText}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatDate(quote.createdAt)}
            </p>
          </>
        )}

        {/* Vendor details */}
        {vendor.specialty && (
          <p className="text-xs text-muted-foreground">
            Specialty: {vendor.specialty}
          </p>
        )}
        {vendor.address && (
          <section className="flex items-start gap-2">
            <MapPin className="size-3 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{vendor.address}</p>
          </section>
        )}
        {vendor.rating !== undefined && (
          <section className="flex items-center gap-2">
            <Star className="size-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Rating: {vendor.rating}/5
            </p>
          </section>
        )}
        {vendor.email && (
          <section className="flex items-center gap-2">
            <Mail className="size-3 text-muted-foreground" />
            <a
              href={`mailto:${vendor.email}`}
              className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors"
            >
              {vendor.email}
            </a>
          </section>
        )}
        {vendor.phone && (
          <section className="flex items-center gap-2">
            <Phone className="size-3 text-muted-foreground" />
            <a
              href={`tel:${vendor.phone}`}
              className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors"
            >
              {vendor.phone}
            </a>
          </section>
        )}
        {vendor.url && (
          <section className="flex items-center gap-2">
            <ExternalLink className="size-3 text-muted-foreground" />
            <a
              href={vendor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors truncate"
            >
              {vendor.url}
            </a>
          </section>
        )}
        {vendor.services && vendor.services.length > 0 && (
          <section className="flex flex-wrap gap-1 mt-2">
            {vendor.services.slice(0, 3).map((service, index) => (
              <Badge key={index} variant="outline" className="text-xs bg-zinc-200/70">
                {service}
              </Badge>
            ))}
            {vendor.services.length > 3 && (
              <Badge variant="outline" className="text-xs bg-zinc-200/70">
                +{vendor.services.length - 3} more
              </Badge>
            )}
          </section>
        )}
      </section>
    </section>
  )
}

