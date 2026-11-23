import Link from "next/link";

/** La marca: "Cartero" dentro de un sello postal. */
export default function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="display stamp inline-block self-start text-lg text-sello">
      Cartero
    </Link>
  );
}
